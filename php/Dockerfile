FROM php:8-apache

# Install required system packages and PHP extensions
RUN apt-get update && apt-get install -y \
    libpq-dev \
    git \
    unzip \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Enable Apache mod_rewrite for API routing
RUN a2enmod rewrite

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy the PHP source and run composer install (before copying public/ to avoid invalidating cache)
COPY composer.json composer.lock* ./
RUN composer install --no-dev --optimize-autoloader

# We will mount or copy files here.
# For production, you would copy the files.
COPY . /var/www/html/

# Allow overriding DocumentRoot and Directory configurations
RUN echo '<Directory /var/www/html>\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>' > /etc/apache2/conf-available/allow-override.conf && \
    a2enconf allow-override

EXPOSE 80
