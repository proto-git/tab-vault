Add-Type -AssemblyName System.Drawing

function Create-Icon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'

    # Background - solid purple (gradient is tricky, keeping it simple)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(102, 126, 234))

    # Rounded rectangle background
    $r = [int]($size * 0.15)
    $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path2.AddArc(0, 0, $r*2, $r*2, 180, 90)
    $path2.AddArc($size-$r*2, 0, $r*2, $r*2, 270, 90)
    $path2.AddArc($size-$r*2, $size-$r*2, $r*2, $r*2, 0, 90)
    $path2.AddArc(0, $size-$r*2, $r*2, $r*2, 90, 90)
    $path2.CloseFigure()
    $g.FillPath($brush, $path2)

    # Document rectangle
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1, [int]($size * 0.06)))
    $pen.LineJoin = 'Round'
    $docL = [int]($size * 0.25)
    $docT = [int]($size * 0.2)
    $docW = [int]($size * 0.4)
    $docH = [int]($size * 0.45)
    $g.DrawRectangle($pen, $docL, $docT, $docW, $docH)

    # Lines inside document
    $lineY1 = [int]($docT + $docH * 0.35)
    $lineY2 = [int]($docT + $docH * 0.55)
    $lineX1 = [int]($docL + $size * 0.06)
    $lineX2 = [int]($docL + $docW - $size * 0.06)
    $g.DrawLine($pen, $lineX1, $lineY1, $lineX2, $lineY1)
    $g.DrawLine($pen, $lineX1, $lineY2, [int]($lineX2 * 0.85), $lineY2)

    # White circle for plus
    $circleSize = [int]($size * 0.32)
    $circleX = [int]($size * 0.58)
    $circleY = [int]($size * 0.58)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillEllipse($whiteBrush, $circleX, $circleY, $circleSize, $circleSize)

    # Plus sign
    $plusPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(102, 126, 234), [Math]::Max(1, [int]($size * 0.06)))
    $cx = $circleX + $circleSize/2
    $cy = $circleY + $circleSize/2
    $pl = [int]($circleSize * 0.25)
    $g.DrawLine($plusPen, $cx, $cy-$pl, $cx, $cy+$pl)
    $g.DrawLine($plusPen, $cx-$pl, $cy, $cx+$pl, $cy)

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $outPath"
}

$iconDir = "C:\Users\danro\Developer\personal\tab-vault\extension\icons"

Create-Icon 16 "$iconDir\icon16.png"
Create-Icon 48 "$iconDir\icon48.png"
Create-Icon 128 "$iconDir\icon128.png"

Write-Host "All icons created successfully!"
