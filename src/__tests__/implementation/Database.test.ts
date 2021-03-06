import { test, assert } from '@sprucelabs/test'
import { errorAssertUtil } from '@sprucelabs/test-utils'
import MongoDatabase, { MONGO_TEST_URI } from '../../databases/MongoDatabase'
import NeDbDatabase from '../../databases/NeDbDatabase'
import SpruceError from '../../errors/SpruceError'
import AbstractDatabaseTest from '../../tests/AbstractDatabaseTest'
import { Database } from '../../types/database.types'

let dbCount = 0
async function mongo(dbConnectionString = MONGO_TEST_URI, dbName?: string) {
	const name = dbName ?? `mercury_${new Date().getTime()}-${dbCount++}`
	const database = new MongoDatabase(dbConnectionString, { dbName: name })

	await database.connect()

	return database
}

async function neDb() {
	const database = new NeDbDatabase()
	await database.connect()
	return database
}

type Connect = (connectionString?: string, dbName?: string) => Promise<Database>

export default class MongoDatabaseTest extends AbstractDatabaseTest {
	private static collectionName = 'test_collection'

	@test('throws error when updating record not found (mongo)', mongo)
	@test('throws error when updating record not found (neDb)', neDb)
	protected static async throwsErrorWhenUpdatingRecordNotFound(
		connect: Connect
	) {
		const db = await connect()
		const err = (await assert.doesThrowAsync(() =>
			db.updateOne('unknown', { id: db.generateId() }, { foo: 'bar' })
		)) as SpruceError

		errorAssertUtil.assertError(err, 'RECORD_NOT_FOUND')

		await this.shutdown(db)
	}

	@test('inserting generates id (mongo)', mongo)
	@test('inserting generates id (neDb)', neDb)
	protected static async insertingGeneratesId(connect: Connect) {
		const db = await connect()
		const inserted = await db.createOne(this.collectionName, {
			name: 'first',
		})

		assert.isTruthy(inserted)
		assert.isString(inserted.id)
		assert.isEqual(inserted.name, 'first')

		await this.shutdown(db)
	}

	private static async shutdown(db: Database) {
		await db.dropDatabase()
		await db.close()
	}

	@test('can sort asc on finds (mongo)', mongo)
	@test('can sort asc on finds (neDb)', neDb)
	protected static async canSortAscResults(connect: Connect) {
		const db = await connect()
		await db.createOne(this.collectionName, { name: 'second', count: 1 })
		await db.createOne(this.collectionName, { name: 'third', count: 5 })
		await db.createOne(this.collectionName, { name: 'first', count: -1 })

		const results = await db.find(
			this.collectionName,
			{},
			{
				sort: [
					{
						field: 'count',
						direction: 'asc',
					},
				],
			}
		)

		assert.isEqual(results[0].name, 'first')
		assert.isEqual(results[1].name, 'second')
		assert.isEqual(results[2].name, 'third')

		const result = await db.findOne(this.collectionName, undefined, {
			sort: [{ field: 'count', direction: 'asc' }],
		})
		assert.isTruthy(result)
		assert.isEqual(result.name, 'first')

		await this.shutdown(db)
	}

	@test('can sort desc (mongo)', mongo)
	@test('can sort desc (neDb)', neDb)
	protected static async canSortDescResults(connect: Connect) {
		const db = await connect()
		await db.createOne(this.collectionName, { name: 'second', count: 1 })
		await db.createOne(this.collectionName, { name: 'third', count: 5 })
		await db.createOne(this.collectionName, { name: 'first', count: -1 })

		const results = await db.find(
			this.collectionName,
			{},
			{
				sort: [
					{
						field: 'count',
						direction: 'desc',
					},
				],
			}
		)

		assert.isEqual(results[0].name, 'third')
		assert.isEqual(results[1].name, 'second')
		assert.isEqual(results[2].name, 'first')

		const result = await db.findOne(this.collectionName, undefined, {
			sort: [{ field: 'count', direction: 'desc' }],
		})
		assert.isTruthy(result)
		assert.isEqual(result.name, 'third')

		await this.shutdown(db)
	}

	@test('sort by id (mongo)', mongo)
	@test('sort by id (neDb)', neDb)
	protected static async canSortById(connect: Connect) {
		const db = await connect()

		await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'first',
		})
		await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'second',
		})
		await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'third',
		})

		const results = await db.find(
			this.collectionName,
			{},
			{
				sort: [
					{
						field: 'id',
						direction: 'desc',
					},
				],
			}
		)

		assert.isEqual(results[0].name, 'third')
		assert.isEqual(results[1].name, 'second')
		assert.isEqual(results[2].name, 'first')

		const result = await db.findOne(this.collectionName, undefined, {
			sort: [{ field: 'id', direction: 'desc' }],
		})
		assert.isTruthy(result)
		assert.isEqual(result.name, 'third')

		await this.shutdown(db)
	}

	@test('can update record (mongo)', mongo)
	@test('can update record (neDb)', neDb)
	protected static async canUpdate(connect: Connect) {
		const db = await connect()

		const inserted = await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'first',
		})

		assert.isString(inserted.id)
		assert.isEqual(inserted.name, 'first')

		const updated = await db.updateOne(
			this.collectionName,
			{ id: inserted.id },
			{
				name: 'updated',
			}
		)

		assert.isEqual(updated.id, inserted.id)
		assert.isEqual(updated.name, 'updated')

		await this.shutdown(db)
	}

	@test('update many (mongo)', mongo)
	@test('update many (neDb)', neDb)
	protected static async updateMany(connect: Connect) {
		const db = await connect()

		await db.create(this.collectionName, [
			{
				name: 'one',
				number: 1,
			},
			{
				name: 'two',
				number: 1,
			},
			{
				name: 'three',
				number: 1,
			},
		])

		await this.assertUpdateUpdatedRightNumberOfRecords(
			db,
			{ name: 'one' },
			{ name: 'one-updated' },
			1
		)

		await this.assertUpdateUpdatedRightNumberOfRecords(
			db,
			{ number: 1 },
			{ number: 2 },
			3
		)

		await this.shutdown(db)
	}

	private static async assertUpdateUpdatedRightNumberOfRecords(
		db: Database,
		search: Record<string, any>,
		updates: Record<string, any>,
		expectedUpdateCount: number
	) {
		const updatedCount = await db.update(this.collectionName, search, updates)

		assert.isEqual(updatedCount, expectedUpdateCount)

		const count = await db.count(this.collectionName, updates)
		assert.isEqual(count, expectedUpdateCount)
	}

	@test('can create many (mongo)', mongo)
	@test('can create many (neDb)', neDb)
	protected static async canCreateMany(connect: Connect) {
		const db = await connect()
		const values = [
			{ first: 'ry' },
			{ first: 'tay' },
			{ first: 'bill' },
			{ first: 'bob' },
		]
		const results = await db.create(this.collectionName, values)

		assert.isLength(results, values.length)
		for (const val of values) {
			assert.doesInclude(results, val)
		}

		await this.shutdown(db)
	}

	@test('can push onto array (mongo)', mongo)
	@test('can push onto array (neDb)', neDb)
	protected static async canPush(connect: Connect) {
		const db = await connect()

		const inserted = await db.createOne(this.collectionName, {
			id: db.generateId(),
			names: ['first'],
		})

		const updated = await db.updateOne(
			this.collectionName,
			{ id: inserted.id },
			{
				$push: { names: 'second' },
			}
		)

		assert.isEqualDeep(updated.names, ['first', 'second'])

		const matched = await db.findOne(this.collectionName, { id: updated.id })

		assert.isTruthy(matched)
		assert.isEqualDeep(matched.names, ['first', 'second'])

		await this.shutdown(db)
	}

	@test('can limit results (mongo)', mongo)
	@test('can limit results (neDb)', neDb)
	protected static async canLimitResults(connect: Connect) {
		const db = await connect()

		await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'first',
		})
		await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'second',
		})
		await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'third',
		})

		const results = await db.find(this.collectionName, undefined, {
			limit: 2,
			sort: [{ field: 'name', direction: 'asc' }],
		})

		assert.isLength(results, 2)
		assert.isEqual(results[0].name, 'first')
		assert.isEqual(results[1].name, 'second')

		await this.shutdown(db)
	}

	@test('can delete record (mongo)', mongo)
	@test('can delete record (neDb)', neDb)
	protected static async canDeleteRecord(connect: Connect) {
		const db = await connect()
		const created = await db.createOne(this.collectionName, {
			id: db.generateId(),
			name: 'first',
		})

		const matchedBeforeDelete = await db.findOne(this.collectionName, {
			id: created.id,
		})

		assert.isTruthy(matchedBeforeDelete)
		assert.isEqual(matchedBeforeDelete.id, created.id)

		const numDeleted = await db.delete(this.collectionName, {
			id: matchedBeforeDelete.id,
		})

		assert.isEqual(numDeleted, 1)

		const matchedAfterDelete = await db.findOne(this.collectionName, {
			id: created.id,
		})

		assert.isFalsy(matchedAfterDelete)

		await db.create(this.collectionName, [
			{
				name: 'a record',
			},
			{
				name: 'a record',
			},
			{
				name: 'a record',
			},
		])

		const manyDeleted = await db.delete(this.collectionName, {})

		assert.isEqual(manyDeleted, 3)

		await this.shutdown(db)
	}

	@test('can delete one (mongo)', mongo)
	@test('can delete one (neDb)', neDb)
	protected static async canDeleteOne(connect: Connect) {
		const db = await connect()

		await db.create(this.collectionName, [
			{
				name: 'a record',
			},
			{
				name: 'a record',
			},
			{
				name: 'a record',
			},
		])

		await db.deleteOne(this.collectionName, { name: 'a record' })

		const count = await db.count(this.collectionName)

		assert.isEqual(count, 2)

		await this.shutdown(db)
	}

	@test('can upsert (mongo)', mongo)
	@test('can upsert (neDb)', neDb)
	protected static async canUpsert(connect: Connect) {
		const db = await connect()

		const id = db.generateId()

		const created = await db.upsertOne(
			this.collectionName,
			{ id },
			{
				id,
				name: 'first',
			}
		)

		assert.isTruthy(created)
		assert.isEqual(created.name, 'first')
		assert.isEqual(created.id, id)

		const upserted = await db.upsertOne(
			this.collectionName,
			{ id },
			{ name: 'second' }
		)

		await db.upsertOne(
			this.collectionName,
			{ id: db.generateId() },
			{ name: 'second' }
		)

		assert.isTruthy(upserted)
		assert.isEqual(created.id, upserted.id)
		assert.isEqual(upserted.name, 'second')

		const upserted2 = await db.upsertOne(
			this.collectionName,
			{ id },
			{ name: 'third' }
		)

		assert.isTruthy(upserted2)
		assert.isEqual(upserted2.name, 'third')

		await this.shutdown(db)
	}

	@test('has no index to start (mongo)', mongo)
	@test('has no index to start (neDb)', neDb)
	protected static async hasNoIndexToStart(connect: Connect) {
		const db = await connect()
		const indexes = await db.getUniqueIndexes(this.collectionName)

		assert.isLength(indexes, 0)
	}

	@test('can create multiple unique indexes (mongo)', mongo)
	@test('can create multiple unique indexes (neDb)', neDb)
	protected static async canCreateUniqueIndex(connect: Connect) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, ['uniqueField'])
		let indexes = await db.getUniqueIndexes(this.collectionName)

		assert.isLength(indexes, 1)
		assert.isLength(indexes[0], 1)
		assert.isEqual(indexes[0][0], 'uniqueField')

		await db.createUniqueIndex(this.collectionName, ['uniqueField2'])
		indexes = await db.getUniqueIndexes(this.collectionName)

		assert.isLength(indexes, 2)
		assert.isEqual(indexes[1][0], 'uniqueField2')

		await db.createUniqueIndex(this.collectionName, [
			'uniqueField3',
			'uniqueField4',
		])
		indexes = await db.getUniqueIndexes(this.collectionName)

		assert.isLength(indexes, 3)
		assert.isEqual(indexes[2][0], 'uniqueField3')
		assert.isEqual(indexes[2][1], 'uniqueField4')
	}

	@test("can't create the same unique indexes twice (mongo)", mongo)
	@test("can't create the same unique indexes twice (neDb)", neDb)
	protected static async cantCreateSameUniqueIndexTwice(connect: Connect) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, ['uniqueField'])
		let indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 1)

		const err = await assert.doesThrowAsync(() =>
			db.createUniqueIndex(this.collectionName, ['uniqueField'])
		)
		errorAssertUtil.assertError(err, 'INDEX_EXISTS')
	}

	@test('can drop index (mongo)', mongo)
	@test('can drop index (neDb)', neDb)
	protected static async canDropIndex(connect: Connect) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, ['someField'])
		await db.dropIndex(this.collectionName, ['someField'])

		let indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 0)

		await db.createUniqueIndex(this.collectionName, ['someField2'])
		await db.createUniqueIndex(this.collectionName, ['someField3'])
		await db.dropIndex(this.collectionName, ['someField3'])
		indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 1)
	}

	@test('can drop compound index (mongo)', mongo)
	@test('can drop compound index (neDb)', neDb)
	protected static async canDropCompoundIndex(connect: Connect) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, ['someField', 'otherField'])
		await db.dropIndex(this.collectionName, ['someField', 'otherField'])

		let indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 0)

		await db.createUniqueIndex(this.collectionName, ['someField', 'someField2'])
		await db.createUniqueIndex(this.collectionName, ['someField', 'someField3'])
		await db.dropIndex(this.collectionName, ['someField', 'someField3'])
		indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 1)
	}

	@test("can't drop index that doesn't exist (mongo)", mongo)
	@test("can't drop index that doesn't exist (neDb)", neDb)
	protected static async cantDropIndexThatDoesntExist(connect: Connect) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, ['someField'])

		const err = await assert.doesThrowAsync(() =>
			db.dropIndex(this.collectionName, ['someOtherField'])
		)
		errorAssertUtil.assertError(err, 'INDEX_NOT_FOUND')
	}

	@test("can't drop index when no indexes exist (mongo)", mongo)
	@test("can't drop index when no indexes exist (neDb)", neDb)
	protected static async cantDropIndexWhenNoIndexExist(connect: Connect) {
		const db = await connect()

		const err = await assert.doesThrowAsync(() =>
			db.dropIndex(this.collectionName, ['someOtherField'])
		)
		errorAssertUtil.assertError(err, 'INDEX_NOT_FOUND')
	}

	@test("can't drop compound index that doesn't exist (mongo)", mongo)
	@test("can't drop compound index that doesn't exist (neDb)", neDb)
	protected static async cantDropCompoundIndexThatDoesntExist(
		connect: Connect
	) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, [
			'someField',
			'someOtherField',
		])

		const err = await assert.doesThrowAsync(() =>
			db.dropIndex(this.collectionName, ['uniqueField', 'someOtherField'])
		)
		errorAssertUtil.assertError(err, 'INDEX_NOT_FOUND')
	}

	@test('syncUniqueIndexes adds missing indexes (mongo)', mongo)
	@test('syncUniqueIndexes adds missing indexes (neDb)', neDb)
	protected static async syncIndexesAddsMissingIndexes(connect: Connect) {
		const db = await connect()
		await db.syncUniqueIndexes(this.collectionName, [['uniqueField']])

		let indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 1)

		await db.syncUniqueIndexes(this.collectionName, [['someField']])

		indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 1)

		await db.syncUniqueIndexes(this.collectionName, [
			['uniqueField'],
			['someField'],
		])

		indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 2)
	}

	@test('syncUniqueIndexes skips existing indexes (mongo)', mongo)
	@test('syncUniqueIndexes skips existing indexes (neDb)', neDb)
	protected static async syncIndexesSkipsExistingIndexes(connect: Connect) {
		const db = await connect()
		await db.syncUniqueIndexes(this.collectionName, [['uniqueField']])

		let indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 1)

		await db.syncUniqueIndexes(this.collectionName, [
			['uniqueField'],
			['someField'],
			['otherField', 'otherField2'],
		])

		indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 3)
	}

	@test('syncUniqueIndexes removes extra indexes (mongo)', mongo)
	@test('syncUniqueIndexes removes extra indexes (neDb)', neDb)
	protected static async syncIndexesRemovesExtraIndexes(connect: Connect) {
		const db = await connect()
		await db.syncUniqueIndexes(this.collectionName, [
			['uniqueField'],
			['someField'],
			['otherField', 'otherField2'],
		])
		let indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 3)

		await db.syncUniqueIndexes(this.collectionName, [['uniqueField']])

		indexes = await db.getUniqueIndexes(this.collectionName)
		assert.isLength(indexes, 1)
		assert.isEqual(indexes[0][0], 'uniqueField')
	}

	@test('syncUniqueIndexes multiple times with different keys (mongo)', mongo)
	@test('syncUniqueIndexes multiple times with different keys (neDb)', neDb)
	protected static async syncIndexesMultipleUpdates(connect: Connect) {
		const db = await connect()
		const syncs = [
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
			db.syncUniqueIndexes(this.collectionName, [
				['otherField', 'otherField2'],
			]),
		]
		await Promise.all(syncs)
	}

	@test(
		'syncUniqueIndexes does not remove and add existing indexes (mongo)',
		mongo
	)
	@test(
		'syncUniqueIndexes does not remove and add existing indexes (neDb)',
		neDb
	)
	protected static async syncIndexesDoesNotRemoveAndAddExistingIndexes(
		connect: Connect
	) {
		const db = await connect()

		await db.createUniqueIndex(this.collectionName, ['otherField'])
		await db.createUniqueIndex(this.collectionName, ['someField'])

		db.createUniqueIndex = () => {
			throw new Error('Should not have been called')
		}
		db.dropIndex = () => {
			throw new Error('Should not have been called')
		}

		await db.syncUniqueIndexes(this.collectionName, [
			['someField'],
			['otherField'],
		])
	}

	@test('can create a unique index that blocks duplicates (mongo)', mongo)
	@test('can create a unique index that blocks duplicates (neDb)', neDb)
	protected static async canCreateUniqueIndexBlocksDuplicates(
		connect: Connect
	) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, ['uniqueField'])

		await db.createOne(this.collectionName, {
			uniqueField: 'hello world',
		})

		let err = (await assert.doesThrowAsync(() =>
			db.createOne(this.collectionName, { uniqueField: 'hello world' })
		)) as SpruceError

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD', {
			collectionName: this.collectionName,
			duplicateFields: ['uniqueField'],
			duplicateValues: ['hello world'],
			action: 'create',
		})

		const created = await db.createOne(this.collectionName, {
			uniqueField: 'pass',
		})

		err = (await assert.doesThrowAsync(() =>
			db.updateOne(
				this.collectionName,
				{ id: created.id },
				{ uniqueField: 'hello world' }
			)
		)) as SpruceError

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD', {
			collectionName: this.collectionName,
			duplicateFields: ['uniqueField'],
			duplicateValues: ['hello world'],
			action: 'updateOne',
		})

		let promises: Promise<any>[] = []
		for (let c = 0; c <= 10; c++) {
			promises.push(
				db.createOne(this.collectionName, {
					uniqueField: 'fast',
				})
			)
		}

		err = (await assert.doesThrowAsync(() =>
			Promise.all(promises)
		)) as SpruceError

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD')

		promises = []
		for (let c = 0; c <= 10; c++) {
			promises.push(
				db.upsertOne(
					this.collectionName,
					{ uniqueField: `${c}` },
					{
						uniqueField: 'upsertFast',
					}
				)
			)
		}

		err = (await assert.doesThrowAsync(() =>
			Promise.all(promises)
		)) as SpruceError

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD')

		await this.shutdown(db)
	}

	@test('can create a compound field unique index (mongo)', mongo)
	@test('can create a compound field unique index (neDb)', neDb)
	protected static async canCreateMultiFieldUniqueIndex(connect: Connect) {
		const db = await connect()
		await db.createUniqueIndex(this.collectionName, [
			'uniqueField',
			'uniqueField2',
		])

		await db.createOne(this.collectionName, {
			uniqueField: 'hello world',
			uniqueField2: 'hello again',
		})

		await db.createOne(this.collectionName, {
			uniqueField: 'hello world',
			uniqueField2: 'unique',
		})

		let err = (await assert.doesThrowAsync(() =>
			db.createOne(this.collectionName, {
				uniqueField: 'hello world',
				uniqueField2: 'unique',
			})
		)) as SpruceError

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD', {
			collectionName: this.collectionName,
			duplicateFields: ['uniqueField', 'uniqueField2'],
			duplicateValues: ['hello world', 'unique'],
			action: 'create',
		})

		await db.upsertOne(
			this.collectionName,
			{
				uniqueField: 'hello world',
				uniqueField2: 'unique',
			},
			{
				uniqueField: 'hello world',
				uniqueField2: 'unique2',
			}
		)

		err = (await assert.doesThrowAsync(() =>
			db.upsertOne(
				this.collectionName,
				{
					uniqueField: 'hello world',
					uniqueField2: 'unique2',
				},
				{
					uniqueField: 'hello world',
					uniqueField2: 'hello again',
				}
			)
		)) as SpruceError

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD', {
			collectionName: this.collectionName,
			duplicateFields: ['uniqueField', 'uniqueField2'],
			duplicateValues: ['hello world', 'hello again'],
			action: 'upsertOne',
		})

		await this.shutdown(db)
	}

	@test(
		'can save, get back, update, and search against null+undefined undefined -> null (mongo)',
		mongo
	)
	@test(
		'can save, get back, update, and search against null+undefined undefined -> null (neDb)',
		neDb
	)
	protected static async canSaveAndGetNullAndUndefined(connect: Connect) {
		const db = await connect()
		const created = await db.createOne(this.collectionName, {
			undefinedField: undefined,
			nullField: null,
		})

		assert.isNull(created.undefinedField)
		assert.isNull(created.nullField)

		const matchedUndefined = await db.findOne(this.collectionName, {
			undefinedField: undefined,
		})

		assert.isTruthy(matchedUndefined)
		assert.isNull(matchedUndefined.undefinedField)

		const matchedNull = await db.findOne(this.collectionName, {
			nullField: null,
		})

		assert.isTruthy(matchedNull)
		assert.isNull(matchedNull.nullField)

		const updatedUndefined = await db.updateOne(
			this.collectionName,
			{
				undefinedField: undefined,
			},
			{ undefinedField: 'now defined' }
		)

		assert.isEqual(updatedUndefined.id, created.id)
		assert.isEqual(updatedUndefined.undefinedField, 'now defined')

		const updatedNull = await db.updateOne(
			this.collectionName,
			{
				nullField: null,
			},
			{ nullField: 'now defined' }
		)

		assert.isEqual(updatedNull.nullField, 'now defined')

		await this.shutdown(db)
	}

	// nodejs mongo lib can't upsert when searching against null field (or maybe non id field???)
	@test.skip(
		'can upsert against null+undefined undefined -> null (mongo)',
		mongo
	)
	@test('can upsert against null+undefined undefined -> null (neDb)', neDb)
	protected static async canUpsertNull(connect: Connect) {
		const db = await connect()

		const createdUndefined = await db.upsertOne(
			this.collectionName,
			{
				undefinedField: undefined,
			},
			{
				undefinedField: undefined,
			}
		)

		assert.isTruthy(createdUndefined)
		assert.isNull(createdUndefined.undefinedField)

		const createdNull = await db.upsertOne(
			this.collectionName,
			{
				nullField: null,
			},
			{
				nullField: null,
			}
		)

		assert.isTruthy(createdNull)

		let all = await db.find(this.collectionName)

		assert.isLength(all, 2)

		const updatedUndefined = await db.upsertOne(
			this.collectionName,
			{
				undefinedField: undefined,
			},
			{ undefinedField: 'now defined' }
		)

		assert.isEqual(updatedUndefined.id, createdUndefined.id)
		assert.isEqual(updatedUndefined.undefinedField, 'now defined')

		const updatedNull = await db.upsertOne(
			this.collectionName,
			{
				nullField: null,
			},
			{ nullField: 'now defined' }
		)

		assert.isEqual(updatedNull.id, createdNull.id)
		assert.isEqual(updatedNull.nullField, 'now defined')

		all = await db.find(this.collectionName)

		assert.isLength(all, 2)

		await this.shutdown(db)
	}

	@test('can count (mongo)', mongo)
	@test('can count (neDb)', neDb)
	protected static async canCount(connect: Connect) {
		const db = await connect()

		await db.createOne(this.collectionName, { foo: 'bar', hello: 'world' })
		await db.createOne(this.collectionName, { foo: 'bar2', hello: 'world' })
		await db.createOne(this.collectionName, { foo: 'bar3', hello: 'planet' })

		const countAll = await db.count(this.collectionName)

		assert.isEqual(countAll, 3)

		await this.shutdown(db)
	}

	@test('can count on id (mongo)', mongo)
	@test('can count on id (neDb)', neDb)
	protected static async canCountOnId(connect: Connect) {
		const db = await connect()

		const first = await db.createOne(this.collectionName, {
			foo: 'bar',
			hello: 'world',
		})
		const second = await db.createOne(this.collectionName, {
			foo: 'bar2',
			hello: 'world',
		})
		const third = await db.createOne(this.collectionName, {
			foo: 'bar3',
			hello: 'planet',
		})

		const countFirst = await db.count(this.collectionName, { id: first.id })
		const countSecond = await db.count(this.collectionName, {
			id: { $in: [first.id, second.id] },
		})
		const countThird = await db.count(this.collectionName, {
			id: { $in: [first.id, second.id, third.id] },
		})

		assert.isEqual(countFirst, 1)
		assert.isEqual(countSecond, 2)
		assert.isEqual(countThird, 3)

		await this.shutdown(db)
	}

	@test('can find by id with $in (mongo)', mongo)
	@test('can find by id with $in (neDb)', neDb)
	protected static async canFindWith$in(connect: Connect) {
		const db = await connect()

		const record1 = await db.createOne(this.collectionName, {
			foo: 'bar',
			hello: 'world',
		})

		const record2 = await db.createOne(this.collectionName, {
			foo: 'bar2',
			hello: 'world',
		})

		const record3 = await db.createOne(this.collectionName, {
			foo: 'bar3',
			hello: 'planet',
		})

		const query = { id: { $in: [record1.id, record2.id, record3.id] } }
		const results = await db.find(this.collectionName, query)

		assert.isLength(results, 3)

		await this.shutdown(db)
	}

	@test(
		'provides helpful duplicate field error with multiple indexes, one at a time (mongo)',
		mongo
	)
	@test(
		'provides helpful duplicate field error with multiple indexes, one at a time (neDb)',
		neDb
	)
	protected static async duplicateFieldsOnMultipleUniqueIndexesHitOneAtATime(
		connect: Connect
	) {
		const db = await connect()

		await db.createUniqueIndex(this.collectionName, ['uniqueField1'])
		await db.createUniqueIndex(this.collectionName, ['uniqueField2'])

		await db.createOne(this.collectionName, {
			uniqueField1: 'unique field 1',
			uniqueField2: 'unique field 2',
		})

		let err = await assert.doesThrowAsync(() =>
			db.createOne(this.collectionName, {
				uniqueField1: 'unique field 1',
				uniqueField2: 'unique field 2',
			})
		)

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD', {
			collectionName: this.collectionName,
			duplicateFields: ['uniqueField1'],
			duplicateValues: ['unique field 1'],
			action: 'create',
		})

		err = await assert.doesThrowAsync(() =>
			db.createOne(this.collectionName, {
				uniqueField1: 'unique field 1.0',
				uniqueField2: 'unique field 2',
			})
		)

		errorAssertUtil.assertError(err, 'DUPLICATE_RECORD', {
			collectionName: this.collectionName,
			duplicateFields: ['uniqueField2'],
			duplicateValues: ['unique field 2'],
			action: 'create',
		})

		await this.shutdown(db)
	}

	@test('can find by $gt, $lt, $gte, $lte (mongo)', mongo)
	@test('can find by $gt, $lt, $gte, $lte (neDb)', neDb)
	protected static async canQueryByGtLtGteLte(connect: Connect) {
		const db = await connect()

		const created = await db.create(this.collectionName, [
			{
				position: 1,
			},
			{
				position: 2,
			},
			{
				position: 3,
			},
			{
				position: 4,
			},
		])

		const gtMatches = await db.find(this.collectionName, {
			id: { $gt: created[2].id },
		})

		assert.isLength(gtMatches, 1)
		assert.isEqual(gtMatches[0].position, 4)

		const gteMatches = await db.find(this.collectionName, {
			id: { $gte: created[2].id },
		})

		assert.isLength(gteMatches, 2)
		assert.isEqual(gteMatches[0].position, 3)
		assert.isEqual(gteMatches[1].position, 4)

		const ltMatches = await db.find(this.collectionName, {
			id: { $lt: created[2].id },
		})

		assert.isLength(ltMatches, 2)
		assert.isEqual(ltMatches[0].position, 1)
		assert.isEqual(ltMatches[1].position, 2)

		const lteMatches = await db.find(this.collectionName, {
			id: { $lte: created[2].id },
		})

		assert.isLength(lteMatches, 3)
		assert.isEqual(lteMatches[0].position, 1)
		assert.isEqual(lteMatches[1].position, 2)
		assert.isEqual(lteMatches[2].position, 3)

		await this.shutdown(db)
	}

	@test('can search by path to sub object (mongo)', mongo)
	@test('can search by path to sub object (neDb)', neDb)
	protected static async canQueryByPathToSubObject(connect: Connect) {
		const db = await connect()

		await db.create(this.collectionName, [
			{
				name: 'first',
				subObject: {
					score: 1,
				},
			},
			{
				name: 'second',
				subObject: {
					score: 2,
				},
			},
			{
				name: 'third',
				subObject: {
					score: 2,
				},
			},
		])

		const secondMatch = await db.findOne(this.collectionName, {
			'subObject.score': 2,
		})

		assert.isTruthy(secondMatch)
		assert.isEqual(secondMatch.name, 'second')

		await this.shutdown(db)
	}

	@test('knows if connected (mongo)', mongo)
	@test('always connected (nedb)', neDb)
	protected static async knowsIfConnected(connect: Connect) {
		const db = await connect()
		assert.isTrue(db.isConnected())

		await db.close()

		assert.isFalse(db.isConnected())
	}

	@test('throws invalid connection string (mongo)', mongo)
	protected static async throwsInvalidConnectionString(connect: Connect) {
		const err = await assert.doesThrowAsync(() => connect('astnoehusantoheun'))
		errorAssertUtil.assertError(err, 'INVALID_DB_CONNECTION_STRING')
	}

	@test('throws unable to connect to db (mongo)', mongo)
	protected static async throwsWhenCantConnectToDb(connect: Connect) {
		const err = await assert.doesThrowAsync(() =>
			connect('mongodb://localhost:9999')
		)
		errorAssertUtil.assertError(err, 'UNABLE_TO_CONNECT_TO_DB')
	}

	@test("can't name a database undefined (mongo)", mongo)
	protected static async cantUndefinedADbName(connect: Connect) {
		const err = await assert.doesThrowAsync(() =>
			connect(undefined, 'undefined')
		)
		errorAssertUtil.assertError(err, 'INVALID_DATABASE_NAME', {
			suppliedName: 'undefined',
		})
	}
}
