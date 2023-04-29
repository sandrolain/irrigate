#!/bin/bash

rm -rf ./kompose
mkdir -p ./kompose/chart

# https://kompose.io/
kompose convert --out ./kompose
kompose convert --out ./kompose/chart --chart
