# robocop-dashboard

This is a dashboard for the [Robocop](https://github.com/Smaug123/robocop) ecosystem.

The dashboard displays the current state of Robocop.
Right now, you just get what's visible to OpenAI (who perform the reviews); I intend adding a display for Robocop's own internal state.

## Data schemas and migration

See the `schemas/` folder for the metadata schemas.

To change the metadata schema, update the dashboard first to accept the new schema (defining how it will display, writing a migration so we can continue to interpret data from older schemas), then set Robocop to emit data in that new schema.

## Why this repo exists

I would normally host the dashboard code within the Robocop repo, but I want to be able to iterate quickly on the service and tool without affecting the frontend.

## Licence

Licensed to you under the [MIT licence](./LICENSE).
