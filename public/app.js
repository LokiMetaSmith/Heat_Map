document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Map
    // Defaulting to roughly the center of the US for visualization
    const map = L.map('map').setView([39.8283, -98.5795], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Setup Heatmap Layer
    const cfg = {
        "radius": 40,
        "maxOpacity": .8,
        "scaleRadius": false,
        "useLocalExtrema": true,
        latField: 'lat',
        lngField: 'lng',
        valueField: 'count'
    };
    const heatmapLayer = new HeatmapOverlay(cfg);
    map.addLayer(heatmapLayer);

    // 2. Fetch and render heatmap data
    async function refreshHeatmap() {
        try {
            const response = await fetch('/api/heatmap');
            const data = await response.json();
            heatmapLayer.setData({
                max: 1,
                data: data
            });
            console.log("Heatmap updated with points:", data.length);
        } catch (error) {
            console.error("Error fetching heatmap:", error);
        }
    }

    // Initial fetch
    await refreshHeatmap();

    // 3. Handle Registration Form
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const address = document.getElementById('address').value;
        const email = document.getElementById('email').value;
        const radius = document.getElementById('radius').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, email, radius })
            });
            const result = await response.json();

            if (response.ok) {
                alert(`Success! Fuzzed location stored.\nLat: ${result.fuzzedLat.toFixed(4)}, Lng: ${result.fuzzedLng.toFixed(4)}`);
                // Clear form
                document.getElementById('address').value = '';
                document.getElementById('email').value = '';

                // Refresh map and zoom to new point
                await refreshHeatmap();
                map.setView([result.fuzzedLat, result.fuzzedLng], 12);
            } else {
                alert("Error: " + result.error);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to register.");
        }
    });

    // 4. Handle "Say Hello" (Click on map to initiate connection)
    let searchCircle = null;

    map.on('click', async (e) => {
        const senderEmail = document.getElementById('senderEmail').value;
        const searchRadius = parseInt(document.getElementById('searchRadius').value);

        if (!senderEmail) {
            alert("Please enter your sender email in the 'Say Hello' box before clicking the map.");
            return;
        }

        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // Draw a temporary circle to show the search area
        if (searchCircle) {
            map.removeLayer(searchCircle);
        }
        searchCircle = L.circle([lat, lng], {
            color: 'blue',
            fillColor: '#30f',
            fillOpacity: 0.2,
            radius: searchRadius
        }).addTo(map);

        if (confirm(`Send a connection request to users within ${searchRadius} meters of this point?`)) {
            try {
                const response = await fetch('/api/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lng, radius: searchRadius, sender_email: senderEmail })
                });

                const result = await response.json();
                alert(result.message);

                // Remove the circle after a short delay
                setTimeout(() => {
                    if (searchCircle) map.removeLayer(searchCircle);
                }, 3000);

            } catch (error) {
                console.error(error);
                alert("Failed to send requests.");
            }
        } else {
            map.removeLayer(searchCircle);
        }
    });
});
