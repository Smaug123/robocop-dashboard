{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in {
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "robocop-dashboard";
          version = "0.1.0";
          src = ./.;

          installPhase = ''
            mkdir -p $out
            cp index.html styles.css $out/
            cp -r src shell $out/
          '';
        };

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.claude-code
            pkgs.codex
            pkgs.alejandra
            pkgs.bun
          ];
        };
      }
    );
}
