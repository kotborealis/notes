module.exports = {
	output: "index.html",
	type: "html",
	html: ["--css=/assets/pandoc.css", "--template=/assets/template.html", "--self-contained"],
	docker: {
		extra_mounts: [`${process.cwd()}/../../assets:/assets`]
	}
}