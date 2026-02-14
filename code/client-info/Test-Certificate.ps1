# 1. Dynamically locate the Windows Downloads folder
$downloadsFolder = Join-Path -Path $env:USERPROFILE -ChildPath "Downloads"
$certPath = Join-Path -Path $downloadsFolder -ChildPath "certificate.cer"

# Check if the file actually exists before proceeding
if (Test-Path $certPath) {
    try {
        # 2. Load the certificate file to get its unique Thumbprint
        $fileCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)
        $targetThumbprint = $fileCert.Thumbprint

        Write-Host "File found at: $certPath" -ForegroundColor Gray
        Write-Host "Searching for Thumbprint: $targetThumbprint" -ForegroundColor Cyan

        # 3. Search common Windows Certificate stores
        # Includes Personal (My) and Trusted Roots (Root) for both User and Machine
        $stores = "Cert:\CurrentUser\My", "Cert:\LocalMachine\My", "Cert:\LocalMachine\Root"
        $foundCert = Get-ChildItem -Path $stores -ErrorAction SilentlyContinue | 
                     Where-Object { $_.Thumbprint -eq $targetThumbprint }

        # 4. Output the result
        if ($foundCert) {
            Write-Host "MATCH FOUND: This certificate is already installed." -ForegroundColor Green
            $foundCert | Select-Object Subject, Thumbprint, PSParentPath | Format-List
        } else {
            Write-Host "NOT FOUND: The certificate is in Downloads, but NOT installed in Windows stores." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: Could not read the certificate file. It might be corrupted or not a valid .cer file." -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: Could not find 'certificate.cer' in $downloadsFolder" -ForegroundColor Red
}