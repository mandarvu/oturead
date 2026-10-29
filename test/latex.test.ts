import { describe, expect, test } from "bun:test"
import { renderDisplay, renderInline } from "../src/math/latex"

describe("renderInline", () => {
  const cases: [string, string][] = [
    ["e^{\\pi\\iota} = -1", "e^(πι) = −1"], // no superscript π/ι exists in Unicode
    ["x^2 + y^2 = z^2", "x² + y² = z²"],
    ["\\alpha_i \\in \\mathbb{R}", "αᵢ ∈ ℝ"],
    ["\\sum_{i=1}^{n} i", "∑ᵢ₌₁ⁿ i"],
    ["\\frac{1}{2} + \\frac{a}{b} + \\frac{a+b}{c}", "½ + a/b + (a + b)/c"],
    ["\\sqrt{a^2+b^2} \\ne \\sqrt[3]{x}", "√(a² + b²) ≠ ∛x"],
    ["f(x) = \\int_0^1 x\\,dx", "f(x) = ∫₀¹ x dx"],
    ["a \\le b \\implies -a \\geq -b", "a ≤ b ⟹ −a ≥ −b"],
    ["\\mathcal{O}(n \\log n)", "𝒪(n log n)"],
    ["\\hat{x} + \\vec{v} + \\bar{z}", "x̂ + v⃗ + z̄"],
    ["\\lim_{x \\to 0} \\frac{\\sin x}{x}", "lim_(x→0) (sin x)/x"],
    ["\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", "(a b; c d)"],
    ["\\left\\{ x \\mid x > 0 \\right\\}", "{x ∣ x > 0}"],
    ["\\text{if } x \\neq 0", "if x ≠ 0"],
    ["\\not\\in \\not= \\not\\subset", "∉ ≠ ⊄"],
    ["f'(x)", "f′(x)"],
    ["\\operatorname{softmax}(z)_i", "softmax(z)ᵢ"],
    ["\\unknowncommand x", "\\unknowncommand x"],
  ]
  for (const [latex, expected] of cases) {
    test(latex, () => expect(renderInline(latex)).toBe(expected))
  }
})

describe("renderDisplay", () => {
  test("raises superscripts that have no Unicode form", () => {
    expect(renderDisplay("e^{\\pi\\iota} = -1")).toEqual([" πι", "e   = −1"])
  })

  test("stacks fractions with a bar as wide as the widest part", () => {
    expect(renderDisplay("\\frac{a+b}{2}")).toEqual(["a + b", "─────", "  2"])
  })

  test("puts limits above and below big operators", () => {
    expect(renderDisplay("\\sum_{i=1}^{n} i")).toEqual([" n", " ∑  i", "i=1"])
  })

  test("draws matrices with tall brackets", () => {
    expect(renderDisplay("\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}")).toEqual(["⎡ 1  0 ⎤", "⎣ 0  1 ⎦"])
  })

  test("aligns at & in aligned environments", () => {
    expect(renderDisplay("\\begin{aligned} a &= b + c \\\\ &= d \\end{aligned}")).toEqual(["a = b + c", "  = d"])
  })

  test("draws a radical with an overbar", () => {
    expect(renderDisplay("\\sqrt{x+1}")).toEqual([" ▁▁▁▁▁", "√x + 1"])
  })
})
