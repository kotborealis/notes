#! /bin/bash

DIST="./dist"
PUBLIC="./app/public"
PUBLIC_ARTICLE="./app/public/article"

CYAN="\033[36m"
GREEN="\033[32m"
WHITE="\033[0m"

echo -e "${CYAN}Start build:\n"

echo -e "${GREEN}Create ${PUBLIC} directory if it does not exist...${WHITE}"
[ -d $PUBLIC ] || mkdir $PUBLIC
[ -d $PUBLIC_ARTICLE ] || mkdir $PUBLIC_ARTICLE

echo -e "${GREEN}Create ${DIST} directory if it does not exist...${WHITE}"
[ -d $DIST ] || mkdir $DIST

echo -e "\n${GREEN}Publish the templates...${WHITE}"
TS_NODE_FILES=true TS_NODE_TRANSPILE_ONLY=true ts-node  ./tools/publish.ts

echo -e "\n${GREEN}Reset distribution directory...${WHITE}"
rm -r $DIST/*

mkdir $DIST/styles
mkdir $DIST/assets
mkdir $DIST/images

echo -e "\n${GREEN}Copy files to distribution directory...${WHITE}"
cp -r ./app/static/* $DIST/
cp -r ./app/public/* $DIST/
cp -r ./app/styles/* $DIST/styles/
cp -r ./app/assets/* $DIST/assets/
cp -r ./images/* $DIST/images/

echo -e "\n${GREEN}Minify css files...${WHITE}"
cleancss --batch --batch-suffix '' $DIST/styles/*.css

echo -e "\n${GREEN}Minify html files...${WHITE}"
html-minifier --input-dir $DIST --output-dir $DIST --file-ext html --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype

echo -e "\n${CYAN}Done!${WHITE}"

