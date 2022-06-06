import Database from '@ioc:Adonis/Lucid/Database'
import Group from 'App/Models/Group'
import User from 'App/Models/User'
import { GroupFactory, UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import { BASE_URL } from '../users/users.spec'

export const groupPayload = {
  name: 'test',
  description: 'test',
  schedule: 'test',
  location: 'test',
  chronic: 'test',
  master: 0,
}

let token = ''
let user = {} as User

test.group('Group', (group) => {
  test('it should create a group', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload })
      .expect(201)

    assert.exists(body.group, 'Group undefined')
    assert.isTrue(body.group.name === groupPayload.name)
    assert.isTrue(body.group.description === groupPayload.description)
    assert.isTrue(body.group.schedule === groupPayload.schedule)
    assert.isTrue(body.group.location === groupPayload.location)
    assert.isTrue(body.group.chronic === groupPayload.chronic)
    assert.isTrue(body.group.master === groupPayload.master)

    assert.exists(body.group.players, 'Players undefined')
    assert.isTrue(body.group.players.length === 1)
    assert.isTrue(body.group.players[0].id === groupPayload.master)
  })

  test('it should return 422 when required data is not provided', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(422)

    assert.isTrue(body.code === 'BAD_REQUEST')
    assert.isTrue(body.status === 422)
  })

  test('it should remove user from group', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()
    const plainPassword = '12345678'
    const res = await UserFactory.merge({ password: plainPassword }).create()
    const response = await supertest(BASE_URL)
      .post('/sessions')
      .send({ email: res.email, password: plainPassword })

    const playerToken = response.body.token.token

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${playerToken}`)

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests/${body.groupRequest.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    await supertest(BASE_URL)
      .delete(`/groups/${group.id}/players/${res.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    await group.load('players')

    assert.isEmpty(group.players)
  })

  test('it should not remove the master of the group', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload })

    const group = await Group.findOrFail(body.group.id)

    await supertest(BASE_URL)
      .delete(`/groups/${group.id}/players/${groupPayload.master}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    await group.load('players')

    assert.isNotEmpty(group.players)
  })

  test('it should remove the group', async (assert) => {
    groupPayload.master = user.id
    const { body } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload })

    const group = await Group.findOrFail(body.group.id)

    await supertest(BASE_URL)
      .delete(`/groups/${group.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200)

    const emptyGroup = await Database.query().from('groups').where('id', group.id)
    const players = await Database.query().from('groups_users')
    assert.isEmpty(emptyGroup)
    assert.isEmpty(players)
  })

  test('it should return 404 when providing an unexistent group for deletion', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .delete('/groups/1')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  test('it should return all groups when no query is provided to list groups', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body: groupCreated } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload })

    const { body } = await supertest(BASE_URL)
      .get('/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groups, 'Groups undefined')
    assert.equal(body.groups.data.length, 1)
    assert.equal(body.groups.data[0].id, groupCreated.group.id)
    assert.equal(body.groups.data[0].name, groupCreated.group.name)
    assert.equal(body.groups.data[0].description, groupCreated.group.description)
    assert.equal(body.groups.data[0].schedule, groupCreated.group.schedule)
    assert.equal(body.groups.data[0].chronic, groupCreated.group.chronic)
    assert.equal(body.groups.data[0].location, groupCreated.group.location)
    assert.exists(body.groups.data[0].masterUser, 'Master undefined')
    assert.equal(body.groups.data[0].masterUser.id, user.id)
    assert.equal(body.groups.data[0].masterUser.username, user.username)
    assert.isNotEmpty(body.groups.data[0].players, 'Empty players')
    assert.equal(body.groups.data[0].players[0].id, user.id)
    assert.equal(body.groups.data[0].players[0].email, user.email)
    assert.equal(body.groups.data[0].players[0].username, user.username)
  })

  test('it should return no groups by user id', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload })

    const { body } = await supertest(BASE_URL)
      .get('/groups?user=123')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groups, 'Groups undefined')
    assert.equal(body.groups.data.length, 0)
  })

  test('it should return all groups by user id', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body: groupCreated } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload })

    const { body } = await supertest(BASE_URL)
      .get(`/groups?user=${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groups, 'Groups undefined')
    assert.equal(body.groups.data.length, 1)
    assert.equal(body.groups.data[0].id, groupCreated.group.id)
    assert.equal(body.groups.data[0].name, groupCreated.group.name)
    assert.equal(body.groups.data[0].description, groupCreated.group.description)
    assert.equal(body.groups.data[0].schedule, groupCreated.group.schedule)
    assert.equal(body.groups.data[0].chronic, groupCreated.group.chronic)
    assert.equal(body.groups.data[0].location, groupCreated.group.location)
    assert.exists(body.groups.data[0].masterUser, 'Master undefined')
    assert.equal(body.groups.data[0].masterUser.id, user.id)
    assert.equal(body.groups.data[0].masterUser.username, user.username)
    assert.isNotEmpty(body.groups.data[0].players, 'Empty players')
    assert.equal(body.groups.data[0].players[0].id, user.id)
    assert.equal(body.groups.data[0].players[0].email, user.email)
    assert.equal(body.groups.data[0].players[0].username, user.username)
  })

  test('it should return all groups by user id and name', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body: groupCreated } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload })

    await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload, name: '123', description: '123' })

    const { body } = await supertest(BASE_URL)
      .get(`/groups?user=${user.id}&text=es`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groups, 'Groups undefined')
    assert.equal(body.groups.data.length, 1)
    assert.equal(body.groups.data[0].id, groupCreated.group.id)
    assert.equal(body.groups.data[0].name, groupCreated.group.name)
    assert.equal(body.groups.data[0].description, groupCreated.group.description)
    assert.equal(body.groups.data[0].schedule, groupCreated.group.schedule)
    assert.equal(body.groups.data[0].chronic, groupCreated.group.chronic)
    assert.equal(body.groups.data[0].location, groupCreated.group.location)
    assert.exists(body.groups.data[0].masterUser, 'Master undefined')
    assert.equal(body.groups.data[0].masterUser.id, user.id)
    assert.equal(body.groups.data[0].masterUser.username, user.username)
    assert.isNotEmpty(body.groups.data[0].players, 'Empty players')
    assert.equal(body.groups.data[0].players[0].id, user.id)
    assert.equal(body.groups.data[0].players[0].email, user.email)
    assert.equal(body.groups.data[0].players[0].username, user.username)
  })

  test('it should return all groups by user id and description', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body: groupCreated } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload, name: '123' })

    await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload, name: '123', description: '123' })

    const { body } = await supertest(BASE_URL)
      .get(`/groups?user=${user.id}&text=es`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groups, 'Groups undefined')
    assert.equal(body.groups.data.length, 1)
    assert.equal(body.groups.data[0].id, groupCreated.group.id)
    assert.equal(body.groups.data[0].name, groupCreated.group.name)
    assert.equal(body.groups.data[0].description, groupCreated.group.description)
    assert.equal(body.groups.data[0].schedule, groupCreated.group.schedule)
    assert.equal(body.groups.data[0].chronic, groupCreated.group.chronic)
    assert.equal(body.groups.data[0].location, groupCreated.group.location)
    assert.exists(body.groups.data[0].masterUser, 'Master undefined')
    assert.equal(body.groups.data[0].masterUser.id, user.id)
    assert.equal(body.groups.data[0].masterUser.username, user.username)
    assert.isNotEmpty(body.groups.data[0].players, 'Empty players')
    assert.equal(body.groups.data[0].players[0].id, user.id)
    assert.equal(body.groups.data[0].players[0].email, user.email)
    assert.equal(body.groups.data[0].players[0].username, user.username)
  })

  test('it should return all groups by name', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body: groupCreated } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload, description: '123' })

    await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload, name: '123', description: '123' })

    const { body } = await supertest(BASE_URL)
      .get(`/groups?text=es`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groups, 'Groups undefined')
    assert.equal(body.groups.data.length, 1)
    assert.equal(body.groups.data[0].id, groupCreated.group.id)
    assert.equal(body.groups.data[0].name, groupCreated.group.name)
    assert.equal(body.groups.data[0].description, groupCreated.group.description)
    assert.equal(body.groups.data[0].schedule, groupCreated.group.schedule)
    assert.equal(body.groups.data[0].chronic, groupCreated.group.chronic)
    assert.equal(body.groups.data[0].location, groupCreated.group.location)
    assert.exists(body.groups.data[0].masterUser, 'Master undefined')
    assert.equal(body.groups.data[0].masterUser.id, user.id)
    assert.equal(body.groups.data[0].masterUser.username, user.username)
    assert.isNotEmpty(body.groups.data[0].players, 'Empty players')
    assert.equal(body.groups.data[0].players[0].id, user.id)
    assert.equal(body.groups.data[0].players[0].email, user.email)
    assert.equal(body.groups.data[0].players[0].username, user.username)
  })

  test('it should return all groups by description', async (assert) => {
    const user = await UserFactory.create()
    groupPayload.master = user.id
    const { body: groupCreated } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload, name: '123' })

    await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...groupPayload, name: '123', description: '123' })

    const { body } = await supertest(BASE_URL)
      .get(`/groups?text=es`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groups, 'Groups undefined')
    assert.equal(body.groups.data.length, 1)
    assert.equal(body.groups.data[0].id, groupCreated.group.id)
    assert.equal(body.groups.data[0].name, groupCreated.group.name)
    assert.equal(body.groups.data[0].description, groupCreated.group.description)
    assert.equal(body.groups.data[0].schedule, groupCreated.group.schedule)
    assert.equal(body.groups.data[0].chronic, groupCreated.group.chronic)
    assert.equal(body.groups.data[0].location, groupCreated.group.location)
    assert.exists(body.groups.data[0].masterUser, 'Master undefined')
    assert.equal(body.groups.data[0].masterUser.id, user.id)
    assert.equal(body.groups.data[0].masterUser.username, user.username)
    assert.isNotEmpty(body.groups.data[0].players, 'Empty players')
    assert.equal(body.groups.data[0].players[0].id, user.id)
    assert.equal(body.groups.data[0].players[0].email, user.email)
    assert.equal(body.groups.data[0].players[0].username, user.username)
  })

  group.before(async () => {
    const plainPassword = '12345678'
    const res = await UserFactory.merge({ password: plainPassword }).create()
    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: res.email, password: plainPassword })
      .expect(201)

    const apiToken = body.token
    token = apiToken.token
    user = res
  })

  group.beforeEach(async () => {
    await Database.beginGlobalTransaction()
  })

  group.afterEach(async () => {
    await Database.rollbackGlobalTransaction()
  })

  group.after(async () => {
    await supertest(BASE_URL).delete('/sessions').set('Authorization', `Bearer ${token}`)
  })
})
