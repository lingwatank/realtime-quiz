# 生成随机 API Key 用于鉴权
# 生成 32 字节 (64 字符) 的十六进制字符串

$apiKey = -join ((1..32) | ForEach-Object { "{0:X2}" -f (Get-Random -Maximum 256) })

Write-Host "======================================"
Write-Host "       API Key 生成成功"
Write-Host "======================================"
Write-Host ""
Write-Host "API Key: $apiKey"
Write-Host ""
Write-Host "======================================"
Write-Host "使用方式:"
Write-Host "======================================"
Write-Host ""
Write-Host "1. 设置到 wrangler.toml 的 [vars] 部分:"
Write-Host "   ADMIN_API_KEY = `"$apiKey`""
Write-Host ""
Write-Host "2. 或使用 wrangler secret 设置 (推荐生产环境):"
Write-Host "   wrangler secret put ADMIN_API_KEY"
Write-Host ""
Write-Host "3. 请求时在 Header 中添加:"
Write-Host "   Authorization: Bearer $apiKey"
Write-Host ""
Write-Host "======================================"
