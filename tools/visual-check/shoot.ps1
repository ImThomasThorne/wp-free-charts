# Visual check: renders every chart type from build/ and screenshots them.
#
#   npm run build
#   powershell -ExecutionPolicy Bypass -File tools\visual-check\shoot.ps1
#
# Writes PNGs to tools\visual-check\out\ (git-ignored):
#   grid-mobile-top / grid-mobile-right    - all 8 types in 375px-wide frames
#   grid-desktop-top / grid-desktop-right  - all 8 types in 760px-wide frames
#   grid-filters                           - every type x filter mode, 2nd button clicked off
#
# Frames are iframes because headless Edge enforces a ~500px minimum window
# width, so a narrow window alone doesn't trigger the mobile layout.
# Pass -BuildDir to compare another build (e.g. one extracted from git).
param(
	[string] $BuildDir,
	[string] $OutDir
)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if ( -not $BuildDir ) { $BuildDir = Join-Path $here '..\..\build' }
if ( -not $OutDir )   { $OutDir   = Join-Path $here 'out' }
$BuildDir = ( Resolve-Path $BuildDir ).Path
New-Item -ItemType Directory -Force $OutDir | Out-Null
$OutDir = ( Resolve-Path $OutDir ).Path

node "$here\gen.mjs" $BuildDir $OutDir | Out-Null

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
# page name -> window size
$shots = [ordered]@{
	'grid-mobile-top'    = '1560,1400'
	'grid-mobile-right'  = '1560,1400'
	'grid-desktop-top'   = '1544,2800'
	'grid-desktop-right' = '1544,2800'
	'grid-filters'       = '1560,2300'
}
foreach ( $name in $shots.Keys ) {
	# AbsoluteUri escapes the space in "Git Repos", which would otherwise split the argument.
	$url = ( [System.Uri] ( Join-Path $OutDir "$name.html" ) ).AbsoluteUri
	# Separate throwaway profile per shot: sharing one makes later shots hang.
	$profile  = Join-Path $env:TEMP "wfc-visual-check-$name"
	$edgeArgs = @( '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
		'--no-first-run', "--user-data-dir=`"$profile`"", "--window-size=$($shots[$name])",
		'--virtual-time-budget=5000', "--screenshot=`"$OutDir\$name.png`"", $url )
	$p = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -WindowStyle Hidden
	# Edge sometimes lingers after writing the PNG; don't wait forever.
	if ( -not $p.WaitForExit( 45000 ) ) { Stop-Process -Id $p.Id -Force }
}
Get-ChildItem "$OutDir\*.png" | Select-Object Name, Length
