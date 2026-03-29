---
name: angular
description: Use when creating or modifying Angular components, services, directives, pipes, or other Angular constructs. Guides Claude to follow this project's Angular 21 conventions.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Angular Development Skill

Follow these conventions when creating or modifying Angular code in this project.

## Project Setup

- **Angular 21** with standalone components (no NgModules)
- **Vitest** for testing (not Karma/Jasmine)
- Components live in `frontend/src/components/`
- Services live in `frontend/src/service/`
- Shared models imported from `@clan-manager/shared`

## Component Conventions

### File naming
- Use flat names without `.component` suffix: `clan-list.ts`, `clan-list.html`, `clan-list.spec.ts`
- Group related files in a directory: `components/clanlist/clan-list.ts`
- Templates use separate `.html` files via `templateUrl`
- Styles use separate `.css` files via `styleUrl` (singular, not `styleUrls`)

### Component structure
- All components are **standalone** (no `standalone: true` needed in Angular 21 — it's the default)
- Use the `imports` array directly in `@Component` for dependencies
- Prefer `signal()` for component state over plain properties
- Use `Observable` with `AsyncPipe` for async data streams
- Inject services via constructor injection

### Example component skeleton
```typescript
import { Component, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-my-feature',
  templateUrl: './my-feature.html',
  styleUrl: './my-feature.css',
  imports: [AsyncPipe]
})
export class MyFeatureComponent {
  protected readonly title = signal('My Feature');
}
```

## Service Conventions

- Services are plain classes with `@Injectable({ providedIn: 'root' })`
- Use RxJS operators (`forkJoin`, `switchMap`, `map`, `shareReplay`) for async composition
- Service files don't have a `.service` suffix: `clash-royale.ts`, not `clash-royale.service.ts`

## Template Conventions

- Use Angular control flow syntax (`@if`, `@for`, `@switch`) instead of structural directives (`*ngIf`, `*ngFor`)
- Use `| async` pipe for observables in templates
- Prefer Tailwind utility classes over custom CSS (see `/styling` skill)

## Testing Conventions

- Test files are colocated with source: `my-component.spec.ts`
- Use **Vitest** with `describe`/`it`/`expect` (not Jasmine)
- Use `TestBed` for component tests
- Mock HTTP with `provideHttpClientTesting` and `HttpTestingController`
- Run tests: `cd frontend && npm test`

## Routing

- Routes defined in `frontend/src/app/app.routes.ts`
- Use lazy loading with `loadComponent` for route components

## Common Imports

- `CommonModule` or specific pipes (`AsyncPipe`, `DatePipe`, etc.) from `@angular/common`
- `NgTemplateOutlet` for template projection
- Models from `@clan-manager/shared` (e.g., `ClanMember`, `ClanResult`, `Eval`)
