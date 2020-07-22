# junit-report-annotations-action

Turn jUnit Reports into Github Action Annotations

## Inputs

## accessToken

When given it will try to create annotations using API, otherwise using workflow commands

## path

**Required**

Glob to your jUnit files

## stripFromPath

This string will be stripped from the path

## errorLevel

Default: warning

Can be used to define the error level in the Annotation