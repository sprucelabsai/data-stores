import fs from "fs";
import globby from "globby";
import pathUtil from "path";
import {
	SchemaHealthCheckItem,
	SkillFeature,
	Skill,
	diskUtil,
	HASH_SPRUCE_DIR_NAME,
} from "@sprucelabs/spruce-skill-utils";

class SchemaFeature implements SkillFeature {
	private skill: Skill;
	private _isBooted = false

	public constructor(skill: Skill) {
		this.skill = skill;
	}

	public execute = async () => {
		await this.loadSchemas();
		this._isBooted = true
	};

	public checkHealth = async () => {
		const schemas = await this.loadSchemas()

		const health: SchemaHealthCheckItem = {
			status: "passed",
			schemas,
		};

		return health;
	};

	public async destroy() {
		this._isBooted = false
	}

	public isInstalled = async () => {
		const schemaPath = pathUtil.join(
			this.skill.rootDir,
			"node_modules",
			"@sprucelabs/schema"
		);

		const isSchemaInstalled = fs.existsSync(schemaPath);

		return isSchemaInstalled;
	};

	public isBooted() {
		return this._isBooted
	}

	private async loadSchemas() {
		const schemaFiles = await globby(
			diskUtil.resolvePath(
				this.skill.activeDir,
				HASH_SPRUCE_DIR_NAME,
				"schemas",
				"**/*.schema.[t|j]s"
			)
		);

		return schemaFiles
			.map((file) => require(file).default).map(schema => ({
				id: schema.id,
				name: schema.name,
				version: schema.version,
				namespace: schema.namespace ?? '***MISSING***',
				description: schema.description,
			}));
	}
}

export default (skill: Skill) => {
	const feature = new SchemaFeature(skill);
	skill.registerFeature("schema", feature);
};
