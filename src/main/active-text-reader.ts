import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const MAX_CONTEXT_LENGTH = 500
const READ_TIMEOUT_MS = 750

const UI_AUTOMATION_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$MaxTextLength = ${MAX_CONTEXT_LENGTH}
$MaxNodes = 60
$MaxDescendantDepth = 3
$MaxAncestorDepth = 6
$Candidates = New-Object System.Collections.Generic.List[object]
$Visited = 0
$Walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker

function Add-Candidate(
  [System.Windows.Automation.AutomationElement] $Element,
  [string] $Relation,
  [int] $Distance,
  [string] $Pattern,
  [string] $Text
) {
  if ($null -eq $Element -or [string]::IsNullOrWhiteSpace($Text)) {
    return
  }

  $current = $Element.Current
  if ($current.IsPassword) {
    return
  }

  $Candidates.Add(@{
    text = $Text
    relation = $Relation
    distance = $Distance
    pattern = $Pattern
    controlType = $current.ControlType.ProgrammaticName
    name = $current.Name
    className = $current.ClassName
    automationId = $current.AutomationId
    processId = $current.ProcessId
  }) | Out-Null
}

function Inspect-Element(
  [System.Windows.Automation.AutomationElement] $Element,
  [string] $Relation,
  [int] $Distance
) {
  if ($null -eq $Element -or $Element.Current.IsPassword) {
    return
  }

  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref] $pattern)) {
    $textPattern = [System.Windows.Automation.TextPattern] $pattern
    $selection = $textPattern.GetSelection()

    if ($null -ne $selection -and $selection.Count -gt 0) {
      $beforeSelection = $textPattern.DocumentRange.Clone()
      $beforeSelection.MoveEndpointByRange(
        [System.Windows.Automation.TextPatternRangeEndpoint]::End,
        $selection[0],
        [System.Windows.Automation.TextPatternRangeEndpoint]::Start
      ) | Out-Null

      Add-Candidate $Element $Relation $Distance 'textPatternBeforeSelection' $beforeSelection.GetText($MaxTextLength)

      $selectionText = $selection[0].GetText($MaxTextLength)
      Add-Candidate $Element $Relation $Distance 'textPatternSelection' $selectionText
    }

    Add-Candidate $Element $Relation $Distance 'textPatternDocument' $textPattern.DocumentRange.GetText($MaxTextLength)
  }

  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref] $pattern)) {
    $valuePattern = [System.Windows.Automation.ValuePattern] $pattern
    Add-Candidate $Element $Relation $Distance 'valuePattern' $valuePattern.Current.Value
  }
}

function Inspect-Descendants(
  [System.Windows.Automation.AutomationElement] $Element,
  [int] $Level
) {
  if ($null -eq $Element -or $Level -gt $MaxDescendantDepth -or $Visited -ge $MaxNodes) {
    return
  }

  $child = $Walker.GetFirstChild($Element)
  while ($null -ne $child -and $Visited -lt $MaxNodes) {
    $Visited++
    Inspect-Element $child 'descendant' $Level
    Inspect-Descendants $child ($Level + 1)
    $child = $Walker.GetNextSibling($child)
  }
}

$element = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($null -eq $element -or $element.Current.IsPassword) {
  @{ candidates = @(); source = 'none' } | ConvertTo-Json -Compress -Depth 6
  exit 0
}

Inspect-Element $element 'focused' 0
Inspect-Descendants $element 1

$ancestor = $Walker.GetParent($element)
$ancestorDistance = 1
while ($null -ne $ancestor -and $ancestorDistance -le $MaxAncestorDepth) {
  Inspect-Element $ancestor 'ancestor' $ancestorDistance
  $ancestor = $Walker.GetParent($ancestor)
  $ancestorDistance++
}

@{ candidates = $Candidates; source = 'candidates' } | ConvertTo-Json -Compress -Depth 6
`

export interface ActiveTextReader {
  getFocusedText(): Promise<string | null>
}

export interface FocusedTextResult {
  text: string | null
  source: string
}

interface FocusedTextCandidate {
  text?: string | null
  relation?: string
  distance?: number
  pattern?: string
  controlType?: string
  name?: string
  className?: string
  automationId?: string
  processId?: number
}

export function resolveAutocompleteContext(bufferContext: string, focusedText: string | null): string {
  if (!focusedText || focusedText.trim().length === 0) return bufferContext
  if (!bufferContext) return focusedText
  if (focusedText.endsWith(bufferContext)) return focusedText

  const bufferStart = focusedText.lastIndexOf(bufferContext)
  if (bufferStart >= 0) {
    return focusedText.slice(0, bufferStart + bufferContext.length)
  }

  return focusedText
}

function normalizeCandidateText(text: string | null | undefined): string | null {
  const normalized = text?.replace(/\0/g, '').replace(/\r\n/g, '\n')
  if (!normalized || normalized.trim().length === 0) return null
  return normalized.slice(-MAX_CONTEXT_LENGTH)
}

function candidateAlignsWithBuffer(text: string, bufferContext: string): boolean {
  if (!bufferContext) return false
  return text.includes(bufferContext)
}

function scoreCandidate(candidate: FocusedTextCandidate, text: string, bufferContext: string): number | null {
  const relation = candidate.relation ?? ''
  const pattern = candidate.pattern ?? ''
  const controlType = candidate.controlType ?? ''
  const distance = candidate.distance ?? 0
  const isDocument = controlType === 'ControlType.Document'
  const isEdit = controlType === 'ControlType.Edit'
  const aligns = candidateAlignsWithBuffer(text, bufferContext)

  if (isDocument && bufferContext && !aligns) return null

  if (
    bufferContext &&
    !aligns &&
    text.trim().length < Math.min(bufferContext.trim().length, 20)
  ) {
    return null
  }

  let score = 0

  if (relation === 'focused') score += 60
  if (relation === 'descendant') score += 45 - distance
  if (relation === 'ancestor') score += 35 - distance

  if (isEdit) score += 35
  else if (isDocument) score += 10
  else score += 15

  if (pattern === 'textPatternBeforeSelection') score += 35
  else if (pattern === 'valuePattern') score += 25
  else if (pattern === 'textPatternDocument') score += 20
  else if (pattern === 'textPatternSelection') score += 5

  if (aligns) score += 40
  if (text.endsWith(bufferContext)) score += 10

  return score
}

export function selectFocusedTextCandidate(
  candidates: FocusedTextCandidate[],
  bufferContext: string
): FocusedTextResult {
  let best: { candidate: FocusedTextCandidate; text: string; score: number } | null = null

  for (const candidate of candidates) {
    const text = normalizeCandidateText(candidate.text)
    if (!text) continue

    const score = scoreCandidate(candidate, text, bufferContext)
    if (score === null) continue

    if (!best || score > best.score) {
      best = { candidate, text, score }
    }
  }

  if (!best) return { text: null, source: 'noUsableCandidate' }

  const { candidate, text, score } = best
  const source = [
    candidate.relation ?? 'unknownRelation',
    candidate.controlType ?? 'unknownControl',
    candidate.pattern ?? 'unknownPattern',
    `score=${score}`
  ].join(':')

  return { text, source }
}

export class WindowsActiveTextReader implements ActiveTextReader {
  async getFocusedText(): Promise<string | null> {
    const result = await this.getFocusedTextResult()
    return result.text
  }

  async getFocusedTextResult(bufferContext = ''): Promise<FocusedTextResult> {
    if (process.platform !== 'win32') {
      return { text: null, source: 'unsupportedPlatform' }
    }

    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', UI_AUTOMATION_SCRIPT],
        {
          timeout: READ_TIMEOUT_MS,
          windowsHide: true,
          maxBuffer: 64 * 1024
        }
      )

      const result = JSON.parse(stdout.trim()) as {
        candidates?: FocusedTextCandidate[] | FocusedTextCandidate
        source?: string
      }
      const rawCandidates = result.candidates
      const candidates = Array.isArray(rawCandidates)
        ? rawCandidates
        : rawCandidates
          ? [rawCandidates]
          : []
      const focusedTextResult = selectFocusedTextCandidate(candidates, bufferContext)
      const text = focusedTextResult.text

      if (!text) {
        return { text: null, source: focusedTextResult.source ?? result.source ?? 'empty' }
      }

      console.log(
        `[active-text-reader] using focused text via ${focusedTextResult.source} (${text.length} chars)`
      )

      return focusedTextResult
    } catch {
      return { text: null, source: 'error' }
    }
  }
}
