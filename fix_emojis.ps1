# Fix emoji mojibake in admin-app.js
$path = ".\js\admin-app.js"
$content = Get-Content -Path $path -Encoding UTF8 -Raw

# Each corrupted sequence -> correct emoji
# The corrupted sequences are Latin-1 misinterpretation of UTF-8 emoji bytes
$fixes = @{
    "ðŸ§'â€ðŸ'¼" = [char]0x1F9D1 + [char]0x200D + [char]0x1F4BC  # 🧑‍💼
    "ðŸ"ž"      = [char]0x1F4DE                                      # 📞
    "ðŸ""       = [char]0x1F4CD                                      # 📍
    "ðŸ‡ªðŸ‡¸"  = [char]0x1F1EA + [char]0x1F1F8                     # 🇪🇸
    "ðŸ‡ºðŸ‡¸"  = [char]0x1F1FA + [char]0x1F1F8                     # 🇺🇸
    "ðŸŒ™"      = [char]0x1F319                                      # 🌙
    "â˜€ï¸"    = [char]0x2600 + [char]0xFE0F                        # ☀️
    "ðŸ'§"      = [char]0x1F4A7                                      # 💧
    "ðŸ"Œ"      = [char]0x1F4CC                                      # 📌
    "ðŸ"…"      = [char]0x1F4C5                                      # 📅
    "ðŸ""       = [char]0x1F512                                      # 🔒
    "ðŸ'¬"      = [char]0x1F4AC                                      # 💬
    "ðŸš€"      = [char]0x1F680                                      # 🚀
    "ðŸ"ˆ"      = [char]0x1F4C8                                      # 📈
    "ðŸ"‰"      = [char]0x1F4C9                                      # 📉
    "âš ï¸"    = [char]0x26A0 + [char]0xFE0F                        # ⚠️
    "ðŸ—'"       = [char]0x1F5D1                                     # 🗑
    "ðŸ'Œ"      = [char]0x1F44C                                      # 👌
    "ðŸ"·"      = [char]0x1F4F7                                      # 📷
    "ðŸ'¾"      = [char]0x1F4BE                                      # 💾
    "ðŸ"¤"      = [char]0x1F4E4                                      # 📤
    "ðŸ"¥"      = [char]0x1F4E5                                      # 📥
    "ðŸ""       = [char]0x1F511                                      # 🔑
    "ðŸ"—"      = [char]0x1F517                                      # 🔗
    "ðŸ"‹"      = [char]0x1F4CB                                      # 📋
    "ðŸŒ"       = [char]0x1F30D                                      # 🌍
    "ðŸ'ˆ"      = [char]0x1F448                                      # 👈
    "ðŸ'"       = [char]0x1F440                                      # 👀 (eyes)
    "ðŸ†"       = [char]0x1F3C6                                      # 🏆
    "ðŸŽ"       = [char]0x1F397                                      # 🎗 (ribbon)
    "ðŸ"²"      = [char]0x1F4F2                                      # 📲
    "ðŸ"£"      = [char]0x1F4E3                                      # 📣
    "ðŸ""       = [char]0x1F514                                      # 🔔
    "ðŸŸ¢"      = [char]0x1F7E2                                      # 🟢
    "ðŸŸ¡"      = [char]0x1F7E1                                      # 🟡
    "ðŸŸ "      = [char]0x1F7E0                                      # 🟠
    "ðŸ"´"      = [char]0x1F534                                      # 🔴
    "ðŸ"µ"      = [char]0x1F535                                      # 🔵
    "ðŸŸ§"      = [char]0x1F7E7                                      # 🟧
}

foreach ($bad in $fixes.Keys) {
    $good = $fixes[$bad]
    $content = $content.Replace($bad, $good)
}

Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
Write-Host "Done! Fixed emoji encoding in $path"
