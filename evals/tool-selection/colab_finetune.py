# %% [markdown]
# # CKAN Tool Selection — Fine-tuning with Unsloth
#
# Fine-tunes a small model (Qwen2.5-0.5B-Instruct) to classify natural language
# queries into CKAN MCP tool names.
#
# **Requirements (Colab)**:
# - Runtime: GPU → T4 (free tier is enough)
# - HF_TOKEN secret set in Colab (Secrets panel, left sidebar)
#
# **Dataset**: aborruso/ckan-tool-selection
# **Base model**: unsloth/Qwen2.5-0.5B-Instruct
# **Output model**: aborruso/ckan-tool-selector (pushed to HF Hub)

# %% [markdown]
# ## 1. Install dependencies

# %%
# %%capture
import subprocess
subprocess.run(["pip", "install", "unsloth", "datasets", "evaluate"], check=True)

# %% [markdown]
# ## 2. Setup — HF token and constants

# %%
import os
from google.colab import userdata  # type: ignore

HF_TOKEN   = userdata.get("HF_TOKEN")
MODEL_ID   = "unsloth/Qwen2.5-0.5B-Instruct"
OUTPUT_ID  = "aborruso/ckan-tool-selector"
DATASET_ID = "aborruso/ckan-tool-selection"

TOOLS = [
    "ckan_package_search",
    "ckan_package_show",
    "ckan_find_relevant_datasets",
    "ckan_status_show",
    "sparql_query",
    "ckan_list_resources",
    "ckan_find_portals",
    "ckan_datastore_search",
]

SYSTEM_PROMPT = (
    "You are a CKAN MCP tool selector. "
    "Given a user query, respond with exactly one tool name from this list:\n"
    + "\n".join(f"- {t}" for t in TOOLS)
    + "\n\nRespond with the tool name only, no explanation."
)

print("Setup done.")

# %% [markdown]
# ## 3. Load dataset

# %%
from datasets import load_dataset

ds = load_dataset(DATASET_ID)
print(ds)
print("\nSample train record:")
print(ds["train"][0])

# %% [markdown]
# ## 4. Load model with Unsloth

# %%
from unsloth import FastLanguageModel
import torch

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_ID,
    max_seq_length=512,
    dtype=None,           # auto-detect (float16 on T4)
    load_in_4bit=True,    # 4-bit quantization → fits T4 easily
    token=HF_TOKEN,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)
print("Model loaded.")

# %% [markdown]
# ## 5. Format dataset for SFT

# %%
def format_record(row):
    messages = [
        {"role": "system",    "content": SYSTEM_PROMPT},
        {"role": "user",      "content": row["nl_query"]},
        {"role": "assistant", "content": row["tool"]},
    ]
    return {"text": tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=False
    )}

train_ds = ds["train"].map(format_record, remove_columns=ds["train"].column_names)
test_ds  = ds["test"].map(format_record,  remove_columns=ds["test"].column_names)

print("Sample formatted record:")
print(train_ds[0]["text"][:400])

# %% [markdown]
# ## 6. Train

# %%
from trl import SFTTrainer
from transformers import TrainingArguments
from unsloth import is_bfloat16_supported

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_ds,
    dataset_text_field="text",
    max_seq_length=512,
    dataset_num_proc=2,
    args=TrainingArguments(
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        warmup_steps=10,
        learning_rate=2e-4,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=20,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=42,
        output_dir="outputs",
        report_to="none",
    ),
)

trainer_stats = trainer.train()
print(f"\nTraining done in {trainer_stats.metrics['train_runtime']:.0f}s")

# %% [markdown]
# ## 7. Evaluate on test set

# %%
FastLanguageModel.for_inference(model)

def predict(nl_query: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": nl_query},
    ]
    input_ids = tokenizer.apply_chat_template(
        messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
    )
    if hasattr(input_ids, "keys"):
        input_ids = input_ids["input_ids"]
    input_ids = input_ids.to("cuda")
    outputs = model.generate(
        input_ids=input_ids,
        max_new_tokens=20,
        do_sample=False,
        use_cache=False,
    )
    decoded = tokenizer.decode(outputs[0][input_ids.shape[1]:], skip_special_tokens=True)
    return decoded.strip()

# Run on test split
correct = 0
per_tool = {t: {"correct": 0, "total": 0} for t in TOOLS}

for row in ds["test"]:
    pred = predict(row["nl_query"])
    gold = row["tool"]
    per_tool[gold]["total"] += 1
    if pred == gold:
        correct += 1
        per_tool[gold]["correct"] += 1

accuracy = correct / len(ds["test"])
print(f"\nOverall accuracy: {accuracy:.1%}  ({correct}/{len(ds['test'])})\n")
print(f"{'Tool':<35} {'Acc':>6}  {'n':>4}")
print("-" * 50)
for tool in TOOLS:
    n = per_tool[tool]["total"]
    c = per_tool[tool]["correct"]
    acc = c / n if n else 0
    print(f"{tool:<35} {acc:>6.1%}  {n:>4}")

# %% [markdown]
# ## 8. Push model to HuggingFace Hub

# %%
model.push_to_hub(OUTPUT_ID, token=HF_TOKEN)
tokenizer.push_to_hub(OUTPUT_ID, token=HF_TOKEN)
print(f"\nModel published: https://huggingface.co/{OUTPUT_ID}")
