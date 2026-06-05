# codemem development

## Commands

```bash
bun run dev:init --project <name> --owner <owner>
bun run dev:capture --project <name> --type <type> --title "<title>" --rule "<rule>"
bun run dev:build --project <name> --lang zh
bun run dev:package --project <name> --version <version> --lang zh
bun run dev:install --package <dir-or-tgz> --target <dir> --project <name> --owner <owner>
bun run dev:projects
bun run gen:skill-docs
bun test
```

## Project structure

```text
codemem/
├── bin/                     # thin command wrappers
├── core/
│   ├── src/                 # runtime code
│   │   ├── cli/             # CLI entry points
│   │   ├── installer/       # install shared package
│   │   ├── packaging/       # build package artifacts
│   │   ├── registry/        # project + package registries
│   │   ├── shared/          # shared helpers
│   │   └── standards/       # capture + render development standards
│   └── dist/                # compiled CLI binaries after build
├── skills/codemem/    # skill definition + templates
├── scripts/                 # build and generation helpers
├── test/                    # integration tests
└── .codemem/                # generated state
```

## Notes

- Treat `skills/codemem/SKILL.md.tmpl` as the source for the generated skill doc.
- `bin/*` should stay thin; real behavior belongs in `core/src/`.
- Keep `.codemem/` as the single state root for logs, registries, and shareable packages.
