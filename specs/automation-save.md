# Specification: Automation and Local Save

## Automation

Each area supports Hands-on, Balanced, and Hands-off. Hands-on requires user action for normal decisions. Balanced automates routine actions and presents major decisions for approval. Hands-off lets the AI resolve the area. Core competition, legal rosters, match simulation, and qualification cannot be disabled.

MVP areas: roster/contracts, training, scouting, and finances. Match tactics remain user-controlled when the user is in Hands-on mode. Disabled secondary systems create no hidden obligations.

## Save behavior

- Store one versioned automatic save in browser local storage after game creation and every successful weekly advance.
- Load the save on application start when valid.
- New Game asks for confirmation and replaces the current save.
- Reset Save asks for confirmation and removes the current save, then returns to the start screen.
- Corrupt or unknown-version saves must produce a recoverable error and must not silently overwrite data.

## Acceptance criteria

- Close/reopen resumes the last successful weekly state.
- New Game and Reset Save require confirmation.
- Save schema includes version and seed/configuration version.
- Automation choices persist in the save.
