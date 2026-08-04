<?php

require __DIR__ . '/vendor/autoload.php';

use App\Encryption;
use App\Fuzzer;
use PHPMailer\PHPMailer\PHPMailer;
use Ramsey\Uuid\Uuid;

// Load environment variables if .env exists
if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database setup
$host = getenv('POSTGRES_HOST') ?: ($_ENV['POSTGRES_HOST'] ?? 'localhost');
$db   = getenv('POSTGRES_DB') ?: ($_ENV['POSTGRES_DB'] ?? 'heatmap');
$user = getenv('POSTGRES_USER') ?: ($_ENV['POSTGRES_USER'] ?? 'postgres');
$pass = getenv('POSTGRES_PASSWORD') ?: ($_ENV['POSTGRES_PASSWORD'] ?? 'password');
$port = getenv('POSTGRES_PORT') ?: ($_ENV['POSTGRES_PORT'] ?? 5432);

$dsn = "pgsql:host=$host;port=$port;dbname=$db";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];
try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$encryption = new Encryption();

// Parse request URI
$requestUri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($requestUri, PHP_URL_PATH);
// The rewrite rule might pass /api/register as the path, but we'll check against /api/ prefix
if (strpos($path, '/api/') !== 0) {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit;
}

// Function to send email via Ethereal (or mocked for tests)
function sendEmail($to, $subject, $text, $html) {
    if (($_ENV['NODE_ENV'] ?? '') === 'test') {
        // Just log or skip in test, or you can write a mocked mailer
        // The node.js app creates ethereal accounts on the fly, but for PHP E2E tests,
        // Playwright test just relies on the endpoint succeeding if it's hitting the API.
        // Wait, Node.js app creates a test account if NOT in test. If IN test, it doesn't create test account.
        return true;
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.ethereal.email';
        $mail->SMTPAuth   = true;
        // In a real app we'd fetch an ethereal account dynamically, but this is a stub
        // to match node behavior. Since ethereal accounts need to be created, we'll just use a mock account
        // if no credentials exist. Wait, let's create an ethereal account on the fly if needed, or just hardcode one for dev.
        // Node.js creates it dynamically on startup. For PHP, we'll try to just pretend it works if we can't create one,
        // or we can make a curl request to ethereal to create one.
        // Actually, the requirements are just parity.
        $ch = curl_init('https://api.nodemailer.com/user');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        $response = curl_exec($ch);
        curl_close($ch);

        $account = json_decode($response, true);
        if (!$account) {
            return false;
        }

        $mail->Username   = $account['user'];
        $mail->Password   = $account['pass'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom('noreply@privacyapp.com', 'Privacy App');
        if (is_array($to)) {
            foreach ($to as $address) {
                $mail->addAddress($address);
            }
        } else {
            $mail->addAddress($to);
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $html;
        $mail->AltBody = $text;

        $mail->send();

        // Log the preview URL
        $previewUrl = 'https://ethereal.email/message/' . $mail->getLastMessageID(); // Note: ethereal preview URL is just an approximation here
        error_log("Message sent. Ethereal account: {$account['user']}");
        return true;
    } catch (\Exception $e) {
        error_log("Message could not be sent. Mailer Error: {$mail->ErrorInfo}");
        return false;
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'POST' && $path === '/api/register') {
    $address = $input['address'] ?? null;
    $email = $input['email'] ?? null;
    $radius = $input['radius'] ?? null;

    if (!$address || !$email || !$radius) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit;
    }

    $nominatimUrl = "https://nominatim.openstreetmap.org/search?q=" . urlencode($address) . "&format=json&limit=1";

    $opts = [
        "http" => [
            "header" => "User-Agent: PrivacyApp/1.0\r\n"
        ]
    ];
    $context = stream_context_create($opts);
    $geocodeResponse = file_get_contents($nominatimUrl, false, $context);

    $geocodeData = json_decode($geocodeResponse, true);

    if (empty($geocodeData)) {
        http_response_code(400);
        echo json_encode(['error' => 'Could not geocode address']);
        exit;
    }

    $exactLat = (float)$geocodeData[0]['lat'];
    $exactLng = (float)$geocodeData[0]['lon'];

    $fuzzed = Fuzzer::fuzzLocation($exactLat, $exactLng, (int)$radius);
    $fuzzedLat = $fuzzed['lat'];
    $fuzzedLng = $fuzzed['lng'];

    $encryptedEmail = $encryption->encryptEmail($email);

    $stmt = $pdo->prepare("
        INSERT INTO users (location, encrypted_email)
        VALUES (ST_SetSRID(ST_MakePoint(?, ?), 4326), ?)
        RETURNING id
    ");
    $stmt->execute([$fuzzedLng, $fuzzedLat, $encryptedEmail]);

    echo json_encode([
        'message' => 'User registered successfully with fuzzed location',
        'fuzzedLat' => $fuzzedLat,
        'fuzzedLng' => $fuzzedLng
    ]);
    exit;
}

if ($method === 'GET' && $path === '/api/heatmap') {
    $stmt = $pdo->query("SELECT ST_Y(location) as lat, ST_X(location) as lng FROM users");
    $rows = $stmt->fetchAll();

    $data = array_map(function($row) {
        return [
            'lat' => (float)$row['lat'],
            'lng' => (float)$row['lng'],
            'count' => 1
        ];
    }, $rows);

    echo json_encode($data);
    exit;
}

if ($method === 'POST' && $path === '/api/connect') {
    $lat = $input['lat'] ?? null;
    $lng = $input['lng'] ?? null;
    $radius = $input['radius'] ?? null;
    $sender_email = $input['sender_email'] ?? null;

    if (!$lat || !$lng || !$radius || !$sender_email) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit;
    }

    $encryptedSenderEmail = $encryption->encryptEmail($sender_email);

    $stmt = $pdo->prepare("
        SELECT id, encrypted_email
        FROM users
        WHERE ST_DWithin(
            location::geography,
            ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
            ?
        )
    ");
    $stmt->execute([$lng, $lat, $radius]);
    $users = $stmt->fetchAll();

    if (empty($users)) {
        echo json_encode(['message' => 'No users found in that area.']);
        exit;
    }

    $emailsSent = 0;
    $port = getenv('PORT') ?: ($_ENV['PORT'] ?? 3000);

    foreach ($users as $user) {
        $token = Uuid::uuid4()->toString();
        $expiresAt = date('Y-m-d H:i:s', time() + 24 * 60 * 60);

        $insertStmt = $pdo->prepare("
            INSERT INTO connection_requests (token, sender_encrypted_email, recipient_id, expires_at)
            VALUES (?, ?, ?, ?)
        ");
        $insertStmt->execute([$token, $encryptedSenderEmail, $user['id'], $expiresAt]);

        $recipientEmail = $encryption->decryptEmail($user['encrypted_email']);
        $connectionLink = "http://localhost:$port/api/connect/$token";

        $subject = "Someone in your area wants to say hello!";
        $text = "Someone requested to connect with you! Click this link to approve and share contact info: $connectionLink";
        $html = "<p>Someone requested to connect with you!</p><p>Click <a href=\"$connectionLink\">this link</a> to approve and share contact info.</p>";

        sendEmail($recipientEmail, $subject, $text, $html);
        $emailsSent++;
    }

    echo json_encode(['message' => "Connection requests sent to $emailsSent users."]);
    exit;
}

if ($method === 'GET' && preg_match('#^/api/connect/([^/]+)$#', $path, $matches)) {
    // For this endpoint, we're mimicking a simple string response, not JSON, to match the node version
    header('Content-Type: text/plain');
    $token = $matches[1];

    $stmt = $pdo->prepare("
        SELECT c.sender_encrypted_email, c.recipient_id, u.encrypted_email as recipient_encrypted_email
        FROM connection_requests c
        JOIN users u ON c.recipient_id = u.id
        WHERE c.token = ? AND c.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $request = $stmt->fetch();

    if (!$request) {
        http_response_code(404);
        echo 'Invalid or expired token.';
        exit;
    }

    $senderEmail = $encryption->decryptEmail($request['sender_encrypted_email']);
    $recipientEmail = $encryption->decryptEmail($request['recipient_encrypted_email']);

    $subject = "You have a new mutual connection!";
    $text = "Great news! You both wanted to connect. \n\nSender: $senderEmail\nRecipient: $recipientEmail\n\nYou can now reply to this email to chat directly.";
    $html = "<p>Great news! You both wanted to connect.</p><p>Sender: $senderEmail<br>Recipient: $recipientEmail</p><p>You can now reply to this email to chat directly.</p>";

    sendEmail([$senderEmail, $recipientEmail], $subject, $text, $html);

    $deleteStmt = $pdo->prepare("DELETE FROM connection_requests WHERE token = ?");
    $deleteStmt->execute([$token]);

    echo 'Connection successful! Check your email to start chatting.';
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);
