#!/usr/bin/env pwsh

Write-Host "============================================"
Write-Host "TESTEO COMPLETO DE REGISTRO Y LOGIN"
Write-Host "============================================"
Write-Host ""

# 1. REGISTRO
Write-Host "[1] TESTEO DE REGISTRO"
Write-Host "- Email: pedro.ciudadano@turismo.com"
Write-Host "- Nombre: Pedro Ruiz"
Write-Host "- Tipo: ciudadano"
Write-Host "- Contrasena: Pedro12345!"
Write-Host ""

$registerJson = @"
{
  "email": "pedro.ciudadano@turismo.com",
  "password": "Pedro12345!",
  "name": "Pedro Ruiz",
  "userType": "ciudadano"
}
"@

try {
    $registerResponse = Invoke-RestMethod -Uri 'http://localhost:8080/auth/register' `
        -Method POST `
        -Body $registerJson `
        -ContentType 'application/json'
    
    if ($registerResponse.success) {
        Write-Host "RESULTADO: EXITO"
        Write-Host "Usuario: $($registerResponse.user.name)"
        Write-Host "Email: $($registerResponse.user.email)"
        Write-Host "Tipo: $($registerResponse.user.userType)"
    } else {
        Write-Host "RESULTADO: FALLO"
        Write-Host "Mensaje: $($registerResponse.message)"
    }
} catch {
    Write-Host "RESULTADO: ERROR"
    Write-Host "Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "[2] TESTEO DE LOGIN"
Write-Host "- Email: pedro.ciudadano@turismo.com"
Write-Host "- Contrasena: Pedro12345!"
Write-Host ""

$loginJson = @"
{
  "email": "pedro.ciudadano@turismo.com",
  "password": "Pedro12345!"
}
"@

try {
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:8080/auth/login' `
        -Method POST `
        -Body $loginJson `
        -ContentType 'application/json'
    
    if ($loginResponse.success) {
        Write-Host "RESULTADO: EXITO"
        Write-Host "Usuario: $($loginResponse.user.name)"
        Write-Host "Email: $($loginResponse.user.email)"
        Write-Host "Tipo: $($loginResponse.user.userType)"
        Write-Host "Token: $($loginResponse.token)"
    } else {
        Write-Host "RESULTADO: FALLO"
        Write-Host "Mensaje: $($loginResponse.message)"
    }
} catch {
    Write-Host "RESULTADO: ERROR"
    Write-Host "Error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "============================================"
Write-Host "Verificando usuarios en base de datos..."
Write-Host "============================================"

psql -U postgres -d "app-turismo" -c "SELECT id, email, name, user_type FROM users ORDER BY id DESC LIMIT 5;"
