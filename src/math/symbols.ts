// LaTeX command -> Unicode tables for rendering math in a terminal.

export const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο",
  pi: "π", varpi: "ϖ", rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ",
  phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ",
  Phi: "Φ", Psi: "Ψ", Omega: "Ω",
}

/** Binary operators: get a space on each side. */
export const BINARY: Record<string, string> = {
  pm: "±", mp: "∓", times: "×", div: "÷", cdot: "⋅", ast: "∗", star: "⋆", circ: "∘", bullet: "∙",
  oplus: "⊕", ominus: "⊖", otimes: "⊗", odot: "⊙", cup: "∪", cap: "∩", setminus: "∖", wedge: "∧",
  land: "∧", vee: "∨", lor: "∨", sqcup: "⊔", sqcap: "⊓", uplus: "⊎", amalg: "⨿", dagger: "†",
}

/** Relations and arrows: get a space on each side. */
export const RELATION: Record<string, string> = {
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", sim: "∼",
  simeq: "≃", cong: "≅", propto: "∝", ll: "≪", gg: "≫", prec: "≺", succ: "≻", preceq: "⪯", succeq: "⪰",
  subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", subsetneq: "⊊", supsetneq: "⊋",
  in: "∈", notin: "∉", ni: "∋", perp: "⊥", parallel: "∥", mid: "∣", nmid: "∤", models: "⊨",
  vdash: "⊢", dashv: "⊣", coloneqq: "≔", doteq: "≐", asymp: "≍", lesssim: "≲", gtrsim: "≳",
  to: "→", rightarrow: "→", leftarrow: "←", gets: "←", Rightarrow: "⇒", Leftarrow: "⇐",
  leftrightarrow: "↔", Leftrightarrow: "⇔", iff: "⟺", implies: "⟹", impliedby: "⟸", mapsto: "↦",
  longrightarrow: "⟶", longleftarrow: "⟵", Longrightarrow: "⟹", Longleftarrow: "⟸",
  longleftrightarrow: "⟷", longmapsto: "⟼", hookrightarrow: "↪", hookleftarrow: "↩",
  uparrow: "↑", downarrow: "↓", Uparrow: "⇑", Downarrow: "⇓", updownarrow: "↕", nearrow: "↗",
  searrow: "↘", nwarrow: "↖", swarrow: "↙", rightharpoonup: "⇀", leftharpoonup: "↼",
  rightleftharpoons: "⇌", leadsto: "⇝",
}

/** Big operators: take limits (above/below in display math for the `LIMITS` ones). */
export const BIG_OPERATOR: Record<string, string> = {
  sum: "∑", prod: "∏", coprod: "∐", int: "∫", iint: "∬", iiint: "∭", oint: "∮", bigcup: "⋃",
  bigcap: "⋂", bigoplus: "⨁", bigotimes: "⨂", bigodot: "⨀", bigvee: "⋁", bigwedge: "⋀", bigsqcup: "⨆",
}

/** Function names typeset upright. */
export const FUNCTIONS = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "coth",
  "log", "ln", "lg", "exp", "lim", "liminf", "limsup", "max", "min", "sup", "inf", "det", "gcd", "lcm",
  "arg", "deg", "dim", "ker", "hom", "Pr", "mod", "tr", "rank", "argmax", "argmin",
])

/** Operators whose limits go above/below in display math. */
export const LIMITS = new Set(["sum", "prod", "coprod", "bigcup", "bigcap", "bigoplus", "bigotimes", "bigodot",
  "bigvee", "bigwedge", "bigsqcup", "lim", "liminf", "limsup", "max", "min", "sup", "inf", "argmax", "argmin", "det", "gcd", "Pr"])

export const SYMBOL: Record<string, string> = {
  infty: "∞", partial: "∂", nabla: "∇", forall: "∀", exists: "∃", nexists: "∄", emptyset: "∅",
  varnothing: "∅", neg: "¬", lnot: "¬", angle: "∠", triangle: "△", therefore: "∴", because: "∵",
  ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", dots: "…", prime: "′", hbar: "ℏ", ell: "ℓ",
  Re: "ℜ", Im: "ℑ", aleph: "ℵ", beth: "ℶ", wp: "℘", degree: "°", top: "⊤", bot: "⊥", clubsuit: "♣",
  diamondsuit: "♢", heartsuit: "♡", spadesuit: "♠", flat: "♭", sharp: "♯", natural: "♮", checkmark: "✓",
  square: "□", blacksquare: "■", Box: "□", diamond: "⋄", imath: "ı", jmath: "ȷ", surd: "√",
  langle: "⟨", rangle: "⟩", lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋", vert: "|", Vert: "‖",
  lvert: "|", rvert: "|", lVert: "‖", rVert: "‖", "|": "‖", "{": "{", "}": "}", lbrace: "{", rbrace: "}",
  backslash: "\\", "%": "%", $: "$", "&": "&", "#": "#", _: "_", colon: ":",
}

export const SPACE: Record<string, string> = {
  ",": " ", ":": " ", ";": " ", ">": " ", " ": " ", quad: "  ", qquad: "    ", "!": "", thinspace: " ",
  enspace: " ", medspace: " ", thickspace: " ", negthinspace: "",
}

const letters = (from: number, text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ") =>
  Object.fromEntries([...text].map((c, i) => [c, String.fromCodePoint(from + i)]))

/** Letter styles, with the holes in the Mathematical Alphanumeric block patched. */
export const FONTS: Record<string, Record<string, string>> = {
  mathbb: {
    ...letters(0x1d538),
    ...{ C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" },
    ...letters(0x1d552, "abcdefghijklmnopqrstuvwxyz"),
    ...letters(0x1d7d8, "0123456789"),
  },
  mathcal: {
    ...letters(0x1d49c),
    ...{ B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ" },
  },
  mathfrak: {
    ...letters(0x1d504),
    ...{ C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" },
    ...letters(0x1d51e, "abcdefghijklmnopqrstuvwxyz"),
  },
  mathbf: { ...letters(0x1d400), ...letters(0x1d41a, "abcdefghijklmnopqrstuvwxyz"), ...letters(0x1d7ce, "0123456789") },
  mathsf: { ...letters(0x1d5a0), ...letters(0x1d5ba, "abcdefghijklmnopqrstuvwxyz") },
  mathtt: { ...letters(0x1d670), ...letters(0x1d68a, "abcdefghijklmnopqrstuvwxyz") },
}
FONTS.mathscr = FONTS.mathcal!
FONTS.boldsymbol = FONTS.mathbf!
FONTS.bm = FONTS.mathbf!

/** Combining marks for accents. */
export const ACCENT: Record<string, string> = {
  hat: "̂", widehat: "̂", bar: "̄", overline: "̅", tilde: "̃", widetilde: "̃",
  vec: "⃗", dot: "̇", ddot: "̈", acute: "́", grave: "̀", breve: "̆",
  check: "̌", underline: "̲", mathring: "̊",
}

export const SUPERSCRIPT: Record<string, string> = {
  ...Object.fromEntries([..."0123456789"].map((d, i) => [d, "⁰¹²³⁴⁵⁶⁷⁸⁹"[i]!])),
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", " ": " ",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ",
  n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
  A: "ᴬ", B: "ᴮ", D: "ᴰ", E: "ᴱ", G: "ᴳ", H: "ᴴ", I: "ᴵ", J: "ᴶ", K: "ᴷ", L: "ᴸ", M: "ᴹ", N: "ᴺ",
  O: "ᴼ", P: "ᴾ", R: "ᴿ", T: "ᵀ", U: "ᵁ", V: "ⱽ", W: "ᵂ",
  α: "ᵅ", β: "ᵝ", γ: "ᵞ", δ: "ᵟ", ε: "ᵋ", ϵ: "ᵋ", θ: "ᶿ", ι: "ᶥ", ϕ: "ᵠ", φ: "ᵠ", χ: "ᵡ",
  "′": "′", "∗": "*", "∘": "°",
}

export const SUBSCRIPT: Record<string, string> = {
  ...Object.fromEntries([..."0123456789"].map((d, i) => [d, "₀₁₂₃₄₅₆₇₈₉"[i]!])),
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", " ": " ",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ",
  s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ", β: "ᵦ", γ: "ᵧ", ρ: "ᵨ", ϕ: "ᵩ", φ: "ᵩ", χ: "ᵪ",
}

export const VULGAR_FRACTION: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/5": "⅕", "2/5": "⅖", "3/5": "⅗",
  "4/5": "⅘", "1/6": "⅙", "5/6": "⅚", "1/7": "⅐", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
  "1/9": "⅑", "1/10": "⅒",
}

/** Glyphs for delimiters stretched over several rows: [top, middle, bottom, fill]. */
export const TALL_DELIMITER: Record<string, [string, string, string, string]> = {
  "(": ["⎛", "⎜", "⎝", "⎜"],
  ")": ["⎞", "⎟", "⎠", "⎟"],
  "[": ["⎡", "⎢", "⎣", "⎢"],
  "]": ["⎤", "⎥", "⎦", "⎥"],
  "{": ["⎧", "⎨", "⎩", "⎪"],
  "}": ["⎫", "⎬", "⎭", "⎪"],
  "|": ["│", "│", "│", "│"],
  "‖": ["‖", "‖", "‖", "‖"],
  "⌈": ["⌈", "│", "│", "│"],
  "⌉": ["⌉", "│", "│", "│"],
  "⌊": ["│", "│", "⌊", "│"],
  "⌋": ["│", "│", "⌋", "│"],
  "⟨": ["╱", "⟨", "╲", "│"],
  "⟩": ["╲", "⟩", "╱", "│"],
}
