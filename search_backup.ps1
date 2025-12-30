
$path = 'C:\Users\devam\AppData\Roaming\Code\User\History'
$term = "toggleOrderWindow"
Write-Host "Searching for '$term' in $path..."

$files = Get-ChildItem -Path $path -Recurse -File
foreach ($f in $files) {
    # Skip small files (less than 1KB) to speed up
    if ($f.Length -gt 1000) {
        try {
            if (Select-String -Path $f.FullName -Pattern $term -Quiet) {
                Write-Output "$($f.FullName) | $($f.Length) | $($f.LastWriteTime)"
            }
        } catch {}
    }
}
