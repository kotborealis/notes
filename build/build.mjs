import path from 'path'
import {promises as fs} from 'fs';

import {$} from 'zx'
import 'zx/globals'
import metadataParser from 'markdown-yaml-metadata-parser'

const config_file = path.join(process.cwd(), '.patchouli.js')
const dist_dir = path.join(process.cwd(), 'dist')
const articles_dir = path.join(process.cwd(), 'articles')

// Create dist directory
await $`rm -rf ${dist_dir} && mkdir ${dist_dir}`

// List articles, except 00
const articles = (await fs.readdir('./articles')).filter(i => i !== '00')

const build = async (id) => {
    console.log(`[${id}] Building...`)
    await $`patchouli --config ${config_file}`
    console.log(`[${id}] Copy to dist...`)
    await $`mv ./index.html ${dist_dir}/${id}.html`
}

// Compile articles
await Promise.all(articles.map(id =>
    within(async () => {
        cd(`${articles_dir}/${id}`)
        await build(id)
    })
))

console.log(`[index] Gather metadata...`)
const index_data =
    (await Promise.all(
        articles
            .map(async dir =>
                ({
                    metadata: metadataParser(
                            (await fs.readFile(`./articles/${dir}/.out/index.md`)).toString()
                        ).metadata,
                    id: dir
                })
            )
    ))
    .sort(({id: a}, {id: b}) => a < b)
    .map(({metadata, id}) => {
        const {title, subtitle, date, tags} = metadata;
        let b = ``;
        b += `* [${title}](./${id}.html) - *${subtitle}* ${date}\n`;
        return b;
    }).reverse();

console.log(`[index] Building...`)
await within(async () => {
    const datafile = `./articles/00/01_data.md`
    await fs.writeFile(datafile, index_data)
    cd(`${articles_dir}/00/`)
    await build(`index`)
    await $`rm -rf ${datafile}`
})

console.log(`Cleanup...`)
await Promise.all([`.out`, `index.html`].map(i => $`find ./articles -name '${i}' | xargs rm -rf`))