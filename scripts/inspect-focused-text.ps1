param(
  [int] $Depth = 4,
  [int] $MaxNodes = 80,
  [switch] $ShowText
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ($env:SHOW_FOCUSED_TEXT -eq '1') {
  $ShowText = $true
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$script:Visited = 0
$script:Walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker

function Format-TextPreview([string] $Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    return '<empty>'
  }

  $normalized = $Text -replace '\s+', ' '
  if ($normalized.Length -gt 120) {
    return ($normalized.Substring(0, 120) + '...')
  }

  return $normalized
}

function Get-PatternInfo([System.Windows.Automation.AutomationElement] $Element) {
  $items = New-Object System.Collections.Generic.List[string]

  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref] $pattern)) {
    $textPattern = [System.Windows.Automation.TextPattern] $pattern
    $documentText = $textPattern.DocumentRange.GetText(500)
    $items.Add("TextPattern chars=$($documentText.Length)")

    $selection = $textPattern.GetSelection()
    if ($null -ne $selection -and $selection.Count -gt 0) {
      $selectionText = $selection[0].GetText(500)
      $items.Add("Selection chars=$($selectionText.Length)")
    }

    if ($ShowText) {
      $items.Add("Text=`"$(Format-TextPreview $documentText)`"")
    }
  }

  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref] $pattern)) {
    $valuePattern = [System.Windows.Automation.ValuePattern] $pattern
    $value = $valuePattern.Current.Value
    $items.Add("ValuePattern chars=$($value.Length)")

    if ($ShowText) {
      $items.Add("Value=`"$(Format-TextPreview $value)`"")
    }
  }

  if ($items.Count -eq 0) {
    return 'no text/value patterns'
  }

  return ($items -join '; ')
}

function Get-ElementLine([System.Windows.Automation.AutomationElement] $Element, [int] $Level) {
  $indent = '  ' * $Level
  $current = $Element.Current
  $name = $current.Name

  if ([string]::IsNullOrEmpty($name)) {
    $name = '<empty>'
  }

  $automationId = $current.AutomationId
  if ([string]::IsNullOrEmpty($automationId)) {
    $automationId = '<empty>'
  }

  $className = $current.ClassName
  if ([string]::IsNullOrEmpty($className)) {
    $className = '<empty>'
  }

  $controlType = $current.ControlType.ProgrammaticName
  $patterns = Get-PatternInfo $Element

  return "$indent- $controlType name=`"$name`" automationId=`"$automationId`" class=`"$className`" pid=$($current.ProcessId) password=$($current.IsPassword) | $patterns"
}

function Walk-Element([System.Windows.Automation.AutomationElement] $Element, [int] $Level) {
  if ($null -eq $Element -or $script:Visited -ge $MaxNodes) {
    return
  }

  $script:Visited++
  Write-Output (Get-ElementLine $Element $Level)

  if ($Level -ge $Depth) {
    return
  }

  $child = $script:Walker.GetFirstChild($Element)
  while ($null -ne $child -and $script:Visited -lt $MaxNodes) {
    Walk-Element $child ($Level + 1)
    $child = $script:Walker.GetNextSibling($child)
  }
}

$focused = [System.Windows.Automation.AutomationElement]::FocusedElement

if ($null -eq $focused) {
  Write-Output 'No focused UI Automation element found.'
  exit 0
}

Write-Output 'Focused element and descendants'
Write-Output '==============================='
Walk-Element $focused 0

Write-Output ''
Write-Output 'Ancestor chain'
Write-Output '=============='

$ancestor = $script:Walker.GetParent($focused)
$level = 0
while ($null -ne $ancestor -and $level -lt 8) {
  Write-Output (Get-ElementLine $ancestor $level)
  $ancestor = $script:Walker.GetParent($ancestor)
  $level++
}

Write-Output ''
Write-Output 'Tip: set SHOW_FOCUSED_TEXT=1 to include a short text preview.'
