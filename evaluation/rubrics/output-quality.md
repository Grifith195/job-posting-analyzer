## Output Quality Rubric

The representative-case analysis is scored on four dimensions from `1` to `5`, for a total of `20`.

### 1. Groundedness

How well the analysis stays anchored to the resume and the sampled job postings.

- `5`: Claims are strongly supported by the resume and the jobs.
- `4`: Mostly grounded, with minor generic phrasing.
- `3`: Mixed grounding with some broad claims.
- `2`: Several weakly supported claims.
- `1`: Mostly generic or poorly grounded.

Script rule:

- The script looks for expected strength and gap themes in the returned analysis.
- It also checks whether the themes mentioned in the analysis are supported by the case expectations or the cleaned job keywords.

### 2. Requirement Coverage

How well the analysis identifies the main requirements from the sampled jobs.

- `5`: Captures nearly all major requirement clusters.
- `4`: Captures most major requirements.
- `3`: Misses one important cluster.
- `2`: Misses several important clusters.
- `1`: Poor understanding of the target role requirements.

Script rule:

- The script compares expected strength themes, expected gap themes, and common requirement themes against the returned analysis text.

### 3. Actionability

How usable the resume suggestions are for improving the resume.

- `5`: Specific and immediately usable suggestions.
- `4`: Mostly useful with minor vagueness.
- `3`: Mixed usefulness.
- `2`: Mostly vague suggestions.
- `1`: Not actionable.

Script rule:

- Suggestions score higher when they are long enough to be specific, use action verbs, and mention a relevant skill, metric, or evidence pattern.

### 4. Score Calibration

How well the score and band match the expected level for the case.

- `5`: Clearly well calibrated.
- `4`: Slightly high or low but still reasonable.
- `3`: Noticeably off.
- `2`: Poorly calibrated.
- `1`: Wrong direction.

Script rule:

- The script compares the returned score against the expected numeric range.
- It also checks whether the returned band is within the case's expected bands.

### Interpretation

- `17-20`: strong
- `13-16`: acceptable
- `9-12`: weak
- `4-8`: poor

### Failure rule

A case is flagged as a failure if either is true:

- total score is below `13`
- any individual dimension is `2` or lower
