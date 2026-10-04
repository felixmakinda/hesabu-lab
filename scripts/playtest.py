"""Automated play-test: plays one round of a mode in a headless browser.

It presses every action button, types a deliberately wrong answer (to check the
mistake-specific hint), then the right answer, and saves screenshots along the way.

Usage (with the game served first, e.g. `pnpm build && pnpm preview --port 4173`):
    python3 scripts/playtest.py add
    python3 scripts/playtest.py div --url "http://localhost:5174/?test" --queue 0.4,0.41 --tag zero

Modes: add, sub, mul, div.
--queue feeds fixed "random" numbers to the problem generator so you get a specific
problem. It only works against the dev server (`pnpm dev`), because it matches the
caller's file name (e.g. division.ts) and production builds are minified.
Example for division: trucks = 2 + floor(q1 * 3), total = 10 + floor(q2 * (max - 9)),
so 0.4,0.41 gives 18 ÷ 3 (no remainder).

Screenshots go to scripts/out/ (git-ignored). Headless Chromium uses software
rendering (~2.5 fps), which is why the game is opened with `?test` (bigger time steps).
"""
import argparse
import os
import re
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CHROMIUM = os.path.expanduser("~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome")

parser = argparse.ArgumentParser()
parser.add_argument("mode", choices=["add", "sub", "mul", "div"])
parser.add_argument("--url", default="http://localhost:4173/?test")
parser.add_argument("--queue", default="", help='fixed random numbers for the problem, e.g. "0.4,0.36"')
parser.add_argument("--tag", default=None, help="screenshot file prefix (defaults to the mode)")
parser.add_argument("--out", default=os.path.join(HERE, "out"))
parser.add_argument("--chromium", default=os.environ.get("CHROMIUM", DEFAULT_CHROMIUM))
args = parser.parse_args()

mode = args.mode
tag = args.tag or mode
os.makedirs(args.out, exist_ok=True)
shot = lambda name: os.path.join(args.out, f"{tag}-{name}.png")  # noqa: E731
GENERATOR_FILE = {"add": "addition.ts", "sub": "subtraction.ts", "mul": "multiplication.ts", "div": "division.ts"}[mode]
errors = []


def answer_for(page):
    """Work out the right answer and the classic wrong one from what's on screen."""
    if mode == "div":
        total, trucks = map(int, re.findall(r"\d+", page.inner_text("#sum .eq")))
        return {"each": total // trucks, "left": total % trucks, "wrong": (total % trucks, total // trucks)}
    m = re.search(r"(\d+) ([+−×]) (\d+)", page.inner_text("#message"))
    a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
    right = {"+": a + b, "−": a - b, "×": a * b}[op]
    if op == "+":
        wrong = (a // 10 + b // 10) * 10 + (a % 10 + b % 10) % 10  # forgot the carry
    elif op == "−":
        wrong = (a // 10 - b // 10) * 10 + abs(a % 10 - b % 10)  # smaller digit from larger
    else:
        wrong = right - b  # one group missing
    return {"right": right, "wrong": wrong}


def type_number(page, n):
    for d in str(n):
        page.keyboard.press(d)
    page.keyboard.press("Enter")


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=args.chromium, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    )
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.goto(args.url)
    page.wait_for_selector(".mode:not([disabled])", timeout=30000)
    if args.queue:
        page.evaluate(
            """([q, file]) => { const orig = Math.random; const vals = q.split(',').map(Number);
               Math.random = () => vals.length && new Error().stack.includes(file) ? vals.shift() : orig(); }""",
            [args.queue, GENERATOR_FILE],
        )
    page.click(f".mode.{mode}", force=True)  # force: the buttons animate, so they're never "stable"

    # Press each action until the keypad appears; screenshot the first time each action shows up.
    seen, n = set(), 0
    deadline = time.time() + 400
    while time.time() < deadline and not page.is_visible("#keypad"):
        btn = page.query_selector("#actions button:not([disabled])")
        if btn:
            label = btn.inner_text().split("×")[0].strip()
            if label not in seen:
                seen.add(label)
                page.screenshot(path=shot(f"{n}-{label.replace(' ', '_')}"))
                n += 1
                print("action:", label, "| msg:", page.inner_text("#message"))
            btn.click(force=True)
        time.sleep(0.3)

    page.wait_for_selector("#keypad:not([hidden])", timeout=120000)
    time.sleep(1)
    page.screenshot(path=shot(f"{n}-answer"))
    ans = answer_for(page)
    print("question:", page.inner_text("#message"), ans)
    print("labels:", [e.inner_text() for e in page.query_selector_all(".world-label")])

    if mode == "div":
        type_number(page, ans["wrong"][0])
        type_number(page, ans["wrong"][1])
    else:
        type_number(page, ans["wrong"])
    time.sleep(0.5)
    print("after wrong:", page.inner_text("#message"))
    time.sleep(6)  # the hint pause is slow at headless frame rates

    if mode == "div":
        type_number(page, ans["each"])
        type_number(page, ans["left"])
    else:
        type_number(page, ans["right"])
    page.wait_for_function("() => document.querySelector('#message').innerText.startsWith('YES')", timeout=60000)
    print("after right:", page.inner_text("#message"))
    time.sleep(1.5)
    page.screenshot(path=shot(f"{n + 1}-correct"))
    browser.close()

print("\n".join(errors) or "no console errors")
