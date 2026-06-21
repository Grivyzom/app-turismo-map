#!/bin/bash

# Restablecer 2FA del superadmin para poder escanear un nuevo código QR
PGPASSWORD="grivyzom@100110" psql -h localhost -U turismo_user -d app-turismo -c "UPDATE admin_users SET totp_ready = false, totp_secret = NULL, status = 'pending_2fa' WHERE email = 'admin@turismomap.com';"

echo "=========================================================="
echo "✅ 2FA para admin@turismomap.com ha sido restablecido."
echo "Al iniciar sesión en http://localhost:8082/dev"
echo "se le mostrará un código QR para configurar en su teléfono."
echo "=========================================================="
