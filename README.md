# Math Universe

An extensible interactive mathematical laboratory for exploring sets, formulas, geometric representations and cross-domain experiments.

## Run

Open `index.html` in a modern browser. No build, backend or API keys required for the first prototype.

## Features

- Interactive Venn diagrams for union, intersection and symmetric difference, with membership proofs.
- Function laboratory for a polynomial, sine wave or Gaussian curve, rendered on a responsive canvas.
- Bitcoin-to-polynomial-roots **illustrative** experiment using deterministic sample observations. Root positions use Durand–Kerner; they are not predictions.
- Formula-first explanation panels and a scene registry prepared for extensions.
- Fully offline, dependency-free baseline for future research and AI integration.

## Design principles

1. Separate the mathematical model from its rendering and the explanation.
2. Every transformation must disclose input units, assumptions, numerical error and whether it is mathematically equivalent or exploratory.
3. Never imply empirical significance from arbitrary transformations.
4. Sandbox future expression parsing; do not use JavaScript `eval` for submitted formulas.
5. Future AI guidance is advisory: deterministic numerical and symbolic engines must check claims.

## Roadmap

- Safe AST expression parser with units/domains.
- WebGL/Three.js 3D scenes and animation timelines.
- SymPy service for symbolic reasoning and proof checks.
- Concept graph linking algebra, calculus, topology, probability, complex analysis, finance and dynamical systems.
- Upload and validation of CSV market datasets, with reproducible provenance.
- Configurable embeddings of time-series into polynomial coefficients, roots and spectral features.
- Saved notebooks, versioned transformations, compare mode and a conversational assistant.

## Tests

Run `node --test tests/*.test.mjs` with Node 20+.

## License

No license is granted by default. Choose a license before accepting outside contributions.
