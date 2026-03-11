# Hydro Addon Link Problem Files

This is a [Hydro](https://github.com/hydro-dev/Hydro) Addon that links problem files to the problem page.

It will insert links (`[<filename>](file://<filename>)`) to the additional files into the problem content.

It's useful for the scenarios that users can't see the file entries directly, such as contest and homework.

## Installation

1. Clone this repository and install dependencies:

    ```bash
    git clone https://github.com/tywzoj/hydro-addon-link-problem-files.git
    cd hydro-addon-link-problem-files
    yarn install --prod
    ```

2. Apply the addon to your Hydro instance:

    ```bash
    hydrooj addon add /path/to/hydro-addon-link-problem-files
    ```

## Usage

Run script `linkProblemFileToContent` on Hydro with args:

- `domainIds` (`string[]`):  The domain IDs to apply the addon to. If not specified, it will be applied to "system". If it's an empty array, it will be applied to all domains.

Example 1: Apply the addon to domains "domain1" and "domain2":

```json
{ "domainIds": ["domain1", "domain2"] }
```

Example 2: Apply the addon to all domains:

```json
{ "domainIds": [] }
```

## License

This addon is licensed under the AGPL-3.0-only License. See [LICENSE](LICENSE) for more details.
