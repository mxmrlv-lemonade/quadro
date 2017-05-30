const _ = require('lodash')
const assert = require('assert')
const DBInflector = require('./db_inflector')

module.exports = class Repository {
  constructor(Model, adapter) {
    this.Model = Model
    this.adapter = adapter
    this.dbInflector = new DBInflector(this.adapter.naming)
    // `collection` in this case defines an abstract collection of items
    // (table, redis list, mongo collection), and is not specific to mongo
    this.dbEntityName = this.dbInflector.collectionName(Model.modelName)
  }

  async save(model) {
    return model._getAttr('id') ? this.update(model) : this.create(model)
  }

  async update(model) {
    let modifiedAttrs = this.modifiedAttributeValues(model)
    return this.adapter.update(
      this.dbEntityName, model._getAttr('id'),
      this.dbInflector.dbFieldsHash(_.omit(modifiedAttrs, 'id'))
    )
  }

  async create(model) {
    // TODO: Implement server generated ids
    let result = await this.adapter.create(
      this.dbEntityName,
      this.dbInflector.dbFieldsHash(this.modifiedAttributeValues(model))
    )
    if (result.id && !model._getAttr('id')) model._setAttr('id', result.id)
    assert.ok(model._getAttr('id'), 'Model `id` attribute is expected to be truthy after `create`')
    model.applyChanges()
  }

  async find(query) {
    let dbQuery = this.dbInflector.dbFieldsHash(query)
    return Promise.map(
      this.adapter.find(this.dbEntityName, dbQuery),
      dbEntity => this.createModelFromDbEntity(dbEntity)
    )
  }

  createModelFromDbEntity(entity) {
    let attrs = this.dbInflector.modelAttributesHash(entity)
    return new this.Model(attrs)
  }

  modifiedAttributeValues(model) {
    return _.mapValues(model.changes(), ({ current }) => current)
  }
}