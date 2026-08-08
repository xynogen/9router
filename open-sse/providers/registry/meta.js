export default {
	id: "meta",
	priority: 30,
	alias: "meta",
	display: {
		name: "Meta (Muse Spark)",
		icon: "auto_awesome",
		color: "#0064FF",
		textIcon: "MT",
		website: "https://www.meta.ai",
		notice: {
			apiKeyUrl: "https://developers.meta.com/",
		},
	},
	category: "apikey",
	transport: {
		baseUrl: "https://api.meta.ai/v1/chat/completions",
		validateUrl: "https://api.meta.ai/v1/models",
	},
	models: [
		{ id: "muse-spark-1.2", name: "Muse Spark 1.2" },
		{ id: "muse-spark-1.1", name: "Muse Spark 1.1" },
		{ id: "muse-spark-1.2-contributor", name: "Muse Spark 1.2 Contributor" },
	],
	serviceKinds: ["llm", "imageToText"],
};
