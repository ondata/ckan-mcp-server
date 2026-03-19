# Evals — Tool Selection

This folder contains experiments to evaluate and improve how an AI model selects
the right CKAN MCP tool given a natural language question.

---

## The big picture: what problem are we solving?

When a user asks something like *"find datasets about air quality in Italy"*, an AI
assistant needs to decide which tool to call — `ckan_package_search`?
`ckan_find_portals`? `ckan_find_relevant_datasets`?

This decision is called **tool selection** (or tool routing), and it is normally
made by a large, expensive language model (like GPT-4, Claude, or Gemini) that
reads the tool descriptions and picks the best one.

Our question: **can we train a tiny, cheap, local model to make the same decision
just as well?**

---

## What we had to start with

The CKAN MCP server deployed on Cloudflare Workers logs every real tool call.
The file `data/worker_events_flat.jsonl` contains **1,824 real calls** with:

| Field | Example |
|---|---|
| `tool` | `ckan_package_search` |
| `query` | `"decreto-legge 32 2026"` |
| `server` | `https://dati.normattiva.it` |
| `outcome` | `ok` |

This is **ground truth data** — we know which tool was actually used for each
real request. The challenge: the `query` field is the CKAN search query, not the
original natural language question the user typed.

---

## Phase 1 — Generate synthetic NL queries

**Script**: `tool-selection/generate_nl_queries.py`
**Output**: `data/nl_eval_queries.jsonl`

### The problem

We have the tool calls, but not the original questions. We cannot train a
classifier without `{question → tool}` pairs.

### The solution: reverse translation

We used **Gemini 2.5 Flash** as a "reverse translator". For each record we gave it:
- the tool that was called
- the CKAN query that was used
- the server URL

And asked: *"what natural language question would a real user type to trigger this?"*

We processed records in **batches of 10** per API call (more efficient than one
call per record). With Gemini's free tier limit of 10 RPM, we set a sleep of 6.5
seconds between calls — all 1,593 records processed in ~18 minutes.

### Key concept: synthetic data generation

This technique — using a large model to generate training data for a smaller one
— is called **synthetic data generation** or **data distillation**. It is a
common and powerful approach when you have real behavioral logs but no labeled
examples.

### Result: 1,583 NL query / tool pairs

```json
{
  "nl_query": "Cerco dati riguardanti gli alberi e il verde urbano a Messina.",
  "tool": "ckan_find_relevant_datasets",
  "server": "https://dati.regione.sicilia.it",
  "original_query": "alberi verde urbano Messina"
}
```

We kept the **top 8 tools** by frequency (covering ~99% of real usage):

| Tool | Records |
|---|---|
| `ckan_package_search` | 618 |
| `ckan_package_show` | 212 |
| `ckan_find_relevant_datasets` | 204 |
| `ckan_status_show` | 183 |
| `sparql_query` | 127 |
| `ckan_list_resources` | 100 |
| `ckan_find_portals` | 74 |
| `ckan_datastore_search` | 65 |

---

## Phase 2 — Dataset split and publish

**Script**: `tool-selection/prepare_dataset.py`
**Output**: `data/train.jsonl` (1,270) + `data/eval.jsonl` (313)
**HuggingFace**: [aborruso/ckan-tool-selection](https://huggingface.co/datasets/aborruso/ckan-tool-selection)

### The split: train vs eval

We split the dataset 80% / 20%:
- **Train**: what the model learns from
- **Eval**: what we use to measure how well it learned — the model never sees
  these examples during training

The split is **stratified by tool**: each tool has ~20% of its examples in eval,
so no tool is over- or under-represented in the test.

### Why publish to HuggingFace?

HuggingFace Hub is the standard platform for sharing models and datasets in the
ML community. Publishing there lets us:
- Load the dataset from anywhere (including Google Colab) with one line of code
- Version and reproduce experiments
- Potentially share the work with others

---

## Phase 3 — Fine-tuning

**Notebook**: `tool-selection/colab_finetune.py` / `.ipynb`
**Platform**: Google Colab (free T4 GPU)
**Library**: [Unsloth](https://github.com/unslothai/unsloth)
**Base model**: `Qwen2.5-0.5B-Instruct` (502M parameters)
**Output model**: [aborruso/ckan-tool-selector](https://huggingface.co/aborruso/ckan-tool-selector)

### What is fine-tuning?

A **pre-trained model** (like Qwen2.5-0.5B) already knows language — it was
trained on hundreds of billions of words from the internet. Fine-tuning takes
this general knowledge and **specializes** it for a specific task, using a much
smaller dataset.

Think of it like hiring someone who already speaks fluent Italian and teaching
them the specific vocabulary of your company — much faster than teaching them
Italian from scratch.

### What is SFT (Supervised Fine-Tuning)?

We use the simplest form of fine-tuning: **SFT**. We show the model many
examples of `{question → correct tool}` pairs and train it to predict the right
tool. Each training example looks like:

```
[system] You are a CKAN MCP tool selector. Given a user query, respond
         with exactly one tool name from this list: ...

[user]   Cerco dati riguardanti gli alberi e il verde urbano a Messina.

[assistant] ckan_find_relevant_datasets
```

The model adjusts its weights to make the correct answer more likely.

### What is LoRA?

Training all 502 million parameters of the model would require a large GPU and
a lot of memory. **LoRA (Low-Rank Adaptation)** is a technique that freezes the
original model weights and only trains a small set of additional "adapter"
matrices.

In our case: we train only **8.8 million out of 502 million parameters** — just
1.75% — but the model still adapts powerfully to our task.

Benefits:
- Fits in a free Colab GPU (T4, 15GB VRAM)
- Trains in minutes instead of hours
- The base model knowledge is preserved

### What is Unsloth?

[Unsloth](https://github.com/unslothai/unsloth) is a library that makes LoRA
fine-tuning **2x faster** and uses less memory than standard approaches. It
works seamlessly with HuggingFace and is the go-to choice for fine-tuning on
consumer GPUs.

### Training parameters

| Parameter | Value | Why |
|---|---|---|
| Epochs | 3 | Enough to learn 8 classes without overfitting |
| Batch size | 4 × 4 (grad acc) | Effective batch of 16, fits T4 |
| Learning rate | 2e-4 | Standard for LoRA fine-tuning |
| LoRA rank | 16 | Balance between expressiveness and size |
| Max seq length | 512 | More than enough for short queries |

### What to watch during training

The key metric is **training loss** — it should decrease steadily:

```
Step  Loss
  20  2.03  ← model is guessing randomly
  40  0.49  ← model is already learning fast
 ...
 240  ~0.1  ← model has learned the task
```

A fast initial drop (like 2.03 → 0.49 in 40 steps) is a very good sign.

---

## Phase 4 — Evaluation and comparison (upcoming)

**Script**: `tool-selection/eval_tool_selection.py`

### What we will measure

On the **313 eval examples** the model never saw during training:
- **Accuracy@1**: is the top prediction the correct tool?
- Per-tool accuracy: which tools are easy / hard?

### The comparison

We will run the same 313 queries through both:
1. Our **fine-tuned Qwen2.5-0.5B** (local, free, fast)
2. **Gemini 2.5 Flash** via API (cloud, costs money, slower)

The hypothesis: the tiny fine-tuned model can match or beat the large general
model on this specific task, because it has been specialized.

---

## Choices and trade-offs

### Why not use the full 20 tools?

The bottom 12 tools together account for less than 1% of real usage. Training on
rare classes with very few examples often hurts accuracy on the common classes.
Starting with the top 8 gives a cleaner signal.

### Why synthetic queries instead of real ones?

Real user questions are never logged (privacy). Synthetic generation from real
call logs is the best available approximation. The quality risk is that Gemini's
"invented" questions may not match how real users actually phrase things — this
is something to validate in Phase 4.

### Why Qwen2.5-0.5B and not a larger model?

For an 8-class classification task with short inputs, 0.5B parameters is more
than enough. Larger models would need more VRAM (paid Colab) and train slower
without meaningful accuracy gains for this specific task.

### Why Google Colab and not a local GPU?

The T4 GPU on free Colab has 15GB VRAM — enough for 4-bit quantized training of
models up to ~7B. No local GPU setup required, no cost.

---

## Future directions

- **More tools**: extend to all 20 tools as more training data accumulates
- **Real NL queries**: collect actual user questions (opt-in, anonymized) to
  replace synthetic data
- **Multilingual**: the current dataset mixes Italian and English — a dedicated
  Italian-only model might perform better for Italian portals
- **Serve locally**: convert the fine-tuned model to GGUF format and run via
  Ollama for zero-cost, zero-latency tool routing
- **Active learning**: use prediction confidence to identify uncertain cases and
  prioritize them for human annotation
