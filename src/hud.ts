// On-screen interface: the written maths panel, messages, action buttons and keypad.
// Colours match the world: orange = tens (crates), cyan = ones (marbles), pink = taken / left over.

import type { Insets } from "./world";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const digits = (n: number) => ({ t: n >= 10 ? String(Math.floor(n / 10)) : "", o: String(n % 10) });

const restart = (el: HTMLElement, cls: string) => {
  el.classList.remove(cls);
  void el.offsetWidth; // restart CSS animation
  el.classList.add(cls);
};

export interface Action {
  id: string;
  label: string;
  count?: number;
  style?: "ones" | "tens" | "pink";
  pulse?: boolean;
}

// ---------- Answer entry state ----------

type Entry =
  | { kind: "number"; text: string; resolve: (n: number) => void }
  | { kind: "share"; fields: [string, string]; active: 0 | 1; resolve: (a: { each: number; left: number }) => void };

let entry: Entry | null = null;
let actionResolve: ((id: string) => void) | null = null;
let actionsShownAt = 0;

function renderEntry() {
  if (!entry) return;
  if (entry.kind === "number") {
    const text = entry.text;
    const t = $("ans-t");
    const o = $("ans-o");
    t.textContent = text.length > 1 ? text[0] : "?";
    o.textContent = text.length === 1 ? text : text.length > 1 ? text[1] : "?";
    t.classList.toggle("filled", text.length > 1);
    o.classList.toggle("filled", text.length > 0);
  } else {
    (["ans-each", "ans-left"] as const).forEach((id, i) => {
      const el = $(id);
      const v = (entry as Extract<Entry, { kind: "share" }>).fields[i];
      el.textContent = v || "?";
      el.classList.toggle("filled", v !== "");
      el.classList.toggle("active", (entry as Extract<Entry, { kind: "share" }>).active === i);
    });
  }
}

function onKey(key: string) {
  if (!entry) return;
  const isDigit = /^[0-9]$/.test(key);
  if (entry.kind === "number") {
    if (isDigit && entry.text.length < 2) entry.text += key;
    else if (key === "⌫") entry.text = entry.text.slice(0, -1);
    else if (key === "✓" && entry.text) {
      const done = entry;
      entry = null;
      done.resolve(Number(done.text));
      return;
    }
  } else {
    const e = entry;
    if (isDigit) {
      e.fields[e.active] = key; // one digit each
      if (e.active === 0) e.active = 1;
    } else if (key === "⌫") {
      if (e.fields[e.active] === "" && e.active === 1) e.active = 0;
      e.fields[e.active] = "";
    } else if (key === "✓") {
      if (e.active === 0 && e.fields[0]) e.active = 1;
      else if (e.fields[0] && e.fields[1]) {
        entry = null;
        e.resolve({ each: Number(e.fields[0]), left: Number(e.fields[1]) });
        return;
      }
    }
  }
  renderEntry();
}

export const hud = {
  // ---------- Messages ----------

  say(text: string, mood: "info" | "good" | "hint" = "info") {
    const el = $("message");
    el.textContent = text;
    el.className = `show ${mood}`;
  },

  setStars(n: number) {
    $("stars").textContent = n > 0 ? "★".repeat(Math.min(n, 10)) + (n > 10 ? ` ${n}` : "") : "";
  },

  // ---------- Panels ----------

  /** Column layout for + and −, with a slot above the tens for a carry or a borrow. */
  renderColumn(op: "+" | "−", a: number, b: number) {
    const A = digits(a);
    const B = digits(b);
    $("sum").innerHTML = `
      <div class="row head"><span></span><span class="t">T</span><span class="o">O</span></div>
      <div class="row carry"><span></span><span class="t"><b id="carry"></b></span><span></span></div>
      <div class="row"><span></span><span class="t" id="a-t">${A.t}</span><span class="o" id="a-o">${A.o}</span></div>
      <div class="row"><span class="op">${op}</span><span class="t">${B.t}</span><span class="o">${B.o}</span></div>
      <div class="rule"></div>
      <div class="row answer"><span></span><span class="t" id="ans-t">?</span><span class="o" id="ans-o">?</span></div>`;
  },

  /** Show the little carried "1" above the tens column. */
  showCarry(n: number) {
    const el = $("carry");
    el.textContent = String(n);
    restart(el, "pop");
  },

  pulseCarry() {
    restart($("carry"), "pulse");
  },

  /** Borrowing: cross out the tens digit, write one less above it, and put a 1 in front of the ones. */
  showBorrow(a: number) {
    const newTens = Math.floor(a / 10) - 1;
    $("a-t").classList.add("struck");
    const carry = $("carry");
    carry.textContent = String(newTens);
    restart(carry, "pop");
    const o = $("a-o");
    o.innerHTML = `<sup class="borrowed">1</sup>${a % 10}`;
    restart(o, "bump");
  },

  pulseBorrow() {
    restart($("carry"), "pulse");
    const sup = document.querySelector<HTMLElement>(".borrowed");
    if (sup) restart(sup, "pulse");
  },

  /** Multiplication: "4 × 6", the groups as chips, and the answer row. */
  renderGroups(groups: number, size: number) {
    const chips = Array.from({ length: groups }, (_, i) => `<span class="chip" id="chip-${i}">${size}</span>`).join("");
    $("sum").innerHTML = `
      <div class="eq"><span class="o">${groups}</span><span class="op">×</span><span class="o">${size}</span></div>
      <div class="eq-sub">${groups} groups of ${size}</div>
      <div class="chips">${chips}</div>
      <div class="rule"></div>
      <div class="row answer"><span class="op">=</span><span class="t" id="ans-t">?</span><span class="o" id="ans-o">?</span></div>`;
  },

  lightGroup(i: number) {
    const chip = $(`chip-${i}`);
    chip.classList.add("done");
    restart(chip, "bump");
  },

  pulseGroups() {
    document.querySelectorAll<HTMLElement>(".chip").forEach((c, i) => setTimeout(() => restart(c, "bump"), i * 180));
  },

  /** Division: "29 ÷ 4", then boxes for "each truck" and "left over". */
  renderDivision(total: number, trucks: number) {
    $("sum").innerHTML = `
      <div class="eq"><span class="o">${total}</span><span class="op">÷</span><span class="o">${trucks}</span></div>
      <div class="eq-sub">share ${total} between ${trucks} trucks</div>
      <div class="rule"></div>
      <div class="share-row"><span>each truck</span><b class="slot" id="ans-each" data-field="0">?</b></div>
      <div class="share-row pink"><span>left over</span><b class="slot" id="ans-left" data-field="1">?</b></div>`;
    document.querySelectorAll<HTMLElement>(".slot").forEach((slot) =>
      slot.addEventListener("click", () => {
        if (entry?.kind !== "share") return;
        entry.active = Number(slot.dataset.field) as 0 | 1;
        renderEntry();
      }),
    );
  },

  // ---------- Answers ----------

  /** Wait for a one- or two-digit answer typed on the keypad. */
  askNumber(): Promise<number> {
    return new Promise((resolve) => {
      entry = { kind: "number", text: "", resolve };
      $("keypad").hidden = false;
      renderEntry();
    });
  },

  /** Wait for "each truck" and "left over" answers (one digit each). */
  askShare(): Promise<{ each: number; left: number }> {
    return new Promise((resolve) => {
      entry = { kind: "share", fields: ["", ""], active: 0, resolve };
      $("keypad").hidden = false;
      renderEntry();
    });
  },

  /** Reset the answer boxes to "?" after a wrong answer. */
  clearAnswer() {
    ["ans-t", "ans-o", "ans-each", "ans-left"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = "?";
      el.classList.remove("filled", "active");
    });
  },

  // ---------- Action buttons ----------

  /** Show buttons and wait for one to be pressed. Resolves with its id. */
  ask(actions: Action[]): Promise<string> {
    const box = $("actions");
    box.innerHTML = actions
      .map(
        (a) => `<button class="action ${a.style ?? "ones"} ${a.pulse ? "pulse" : ""}" data-id="${a.id}">
          ${a.label}${a.count !== undefined ? ` <span class="count">× ${a.count}</span>` : ""}</button>`,
      )
      .join("");
    actionsShownAt = performance.now();
    return new Promise((resolve) => (actionResolve = resolve));
  },

  clearActions() {
    $("actions").innerHTML = "";
    actionResolve = null;
  },

  /** Row of little marbles above the buttons showing how many are left to drop/take. */
  setHopper(n: number, style: "ones" | "pink" = "ones") {
    $("hopper").innerHTML = Array.from({ length: n }, () => `<i class="${style}"></i>`).join("");
  },

  /**
   * How much of each screen edge the HUD covers, read from the --scene-* CSS variables that
   * the phone layouts set in style.css. Null on desktop, where the camera keeps its own framing.
   */
  sceneInsets(): Insets | null {
    const css = getComputedStyle($("hud"));
    const px = (side: string) => parseFloat(css.getPropertyValue(`--scene-${side}`)) || 0;
    const insets = { top: px("top"), right: px("right"), bottom: px("bottom"), left: px("left") };
    return Object.values(insets).some((v) => v > 0) ? insets : null;
  },

  showKeypad(show: boolean) {
    $("keypad").hidden = !show;
  },

  reset() {
    entry = null;
    this.clearActions();
    this.setHopper(0);
    this.showKeypad(false);
    $("sum").innerHTML = "";
  },
};

function pressAction(id: string) {
  // Ignore presses in the first instant after buttons appear (stops held keys from racing ahead).
  if (!actionResolve || performance.now() - actionsShownAt < 120) return;
  const resolve = actionResolve;
  actionResolve = null;
  $("actions").querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = true));
  resolve(id);
}

/** Wire up the keypad, action buttons and keyboard once at startup. */
export function initHud() {
  const pad = $("keypad");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "⌫", "✓"];
  pad.innerHTML = keys
    .map((k) => `<button data-key="${k}" class="${k === "✓" ? "ok" : k === "⌫" ? "back" : ""}">${k}</button>`)
    .join("");
  pad.addEventListener("click", (e) => {
    const key = (e.target as HTMLElement).closest("button")?.dataset.key;
    if (key) onKey(key);
  });

  $("actions").addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("button")?.dataset.id;
    if (id) pressAction(id);
  });

  window.addEventListener("keydown", (e) => {
    if (entry) {
      if (/^[0-9]$/.test(e.key)) onKey(e.key);
      else if (e.key === "Backspace") onKey("⌫");
      else if (e.key === "Enter") onKey("✓");
      return;
    }
    if (e.code === "Space" || e.key === "Enter") {
      const first = $("actions").querySelector<HTMLButtonElement>("button:not(:disabled)");
      if (first) {
        e.preventDefault();
        pressAction(first.dataset.id!);
      }
    }
  });
}
