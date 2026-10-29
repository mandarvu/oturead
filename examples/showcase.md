# oturead showcase

A terminal markdown reader that renders documents the way **opencode** renders
streamed LLM output. Supports *italics*, **bold**, ***both***, ~~strikethrough~~,
`inline code`, <u>underlined words</u>, ==highlighted words== and <mark>marked text</mark>.
Links look like [the opencode repo](https://github.com/sst/opencode).

## Lists

- First bullet with **bold** text
- Second bullet with `code`
  - Nested bullet
    - Deeper still
- Back at the top level

1. Ordered item one
2. Ordered item two
3. Ordered item three

- [x] Write the renderer
- [x] Add themes
- [ ] Take over the world

## Quotes

> The best way to predict the future is to invent it.
> — Alan Kay

> **Note:** quotes can contain _inline_ formatting and `code` too.

## Tables

| Language   | Typing     | Paradigm              | First appeared |
|------------|------------|-----------------------|---------------:|
| TypeScript | static     | multi-paradigm        |           2012 |
| Rust       | **static** | ==systems==, functional |           2010 |
| Python     | dynamic    | multi-paradigm        |           1991 |
| Go         | static     | concurrent, <u>imperative</u> |           2009 |

## Code

### TypeScript

```typescript
interface User {
  id: number
  name: string
}

export async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error("not found")
  return res.json() as Promise<User>
}
```

### Python

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def dist(self, other: "Point") -> float:
        # Euclidean distance
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
```

### Rust

```rust
fn main() {
    let words = vec!["hello", "world"];
    for (i, w) in words.iter().enumerate() {
        println!("{i}: {w}");
    }
}
```

### Go

```go
package main

import "fmt"

func main() {
	ch := make(chan int)
	go func() { ch <- 42 }()
	fmt.Println(<-ch)
}
```

### Bash

```bash
#!/usr/bin/env bash
for f in *.md; do
  echo "rendering $f"
  oturead "$f"
done
```

---

#### Level four heading

##### Level five heading

###### Level six heading

That's all, folks.
