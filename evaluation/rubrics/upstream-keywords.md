## Upstream Keyword Evaluation

The upstream component under evaluation is keyword extraction inside `cleanAdzunaJobs()`.

### Why this component

- It happens before the final LLM output.
- It is deterministic and easy to debug.
- The extracted keyword signals are stored in silver artifacts and are included in the final analysis prompt.

### Fixture format

Each annotated fixture contains:

- one raw Adzuna-style job
- a list of expected extracted keywords

### Metrics

The script computes micro-averaged metrics across all fixtures:

- `Precision = correct predicted keywords / total predicted keywords`
- `Recall = correct predicted keywords / total expected keywords`
- `F1 = 2PR / (P + R)`

The results file also includes per-fixture predictions so misses are easy to inspect.

### Target

- `F1 >= 0.70` is a healthy result for this lightweight extractor.
- Lower recall than precision is especially important because it means the ETL is dropping useful role signals before the final analysis step.
