@echo off
REM Build script for CI/CD - creates environment.ts from template

echo Creating environment.ts from template...

REM Copy template to actual environment file
copy src\environments\environment.template.ts src\environments\environment.ts

echo Environment file created successfully!