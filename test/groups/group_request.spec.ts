import Database from '@ioc:Adonis/Lucid/Database'
import GroupRequest from 'App/Models/GroupRequest'
import User from 'App/Models/User'
import { GroupFactory, UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import { BASE_URL } from '../users/users.spec'
import { groupPayload } from './group.spec'

let token: string
let user: User

test.group('Group Request', (group) => {
  test('it should create a group request', async (assert) => {
    const { id } = await UserFactory.create()
    const group = await GroupFactory.merge({ master: id }).create()
    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201)

    assert.exists(body.groupRequest, 'Group Request undefined')
    assert.equal(body.groupRequest.userId, user.id)
    assert.equal(body.groupRequest.groupId, group.id)
    assert.equal(body.groupRequest.status, 'PENDING')
  })

  test('it should return 409 when group request already exists', async (assert) => {
    const { id } = await UserFactory.create()
    const group = await GroupFactory.merge({ master: id }).create()
    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201)

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 409)
  })

  test('it should return 422 when user is already in the group', async (assert) => {
    groupPayload.master = user.id
    const { body } = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send(groupPayload)

    const response = await supertest(BASE_URL)
      .post(`/groups/${body.group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .expect(422)

    assert.equal(response.body.code, 'BAD_REQUEST')
    assert.equal(response.body.status, 422)
  })

  test('it should list group request by master', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    const groupRequest = response.body.groupRequest

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests?master=${master.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groupRequests, 'Group Requests undefined')
    assert.equal(body.groupRequests.length, 1)
    assert.equal(body.groupRequests[0].id, groupRequest.id)
    assert.equal(body.groupRequests[0].userId, groupRequest.userId)
    assert.equal(body.groupRequests[0].groupId, groupRequest.groupId)
    assert.equal(body.groupRequests[0].user.username, user.username)
    assert.equal(body.groupRequests[0].group.master, master.id)
  })

  test('it should return an empty list when master has no group request', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests?master=${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(body.groupRequests, 'GroupRequests undefined')
    assert.equal(body.groupRequests.length, 0)
  })

  test('it should return 422 when master is not provided', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should accept a group request', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests/${body.groupRequest.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.exists(response.body.groupRequest, 'GroupRequest undefined')
    assert.equal(response.body.groupRequest.groupId, group.id)
    assert.equal(response.body.groupRequest.status, 'ACCEPTED')

    await group.load('players')

    assert.isNotEmpty(group.players)
    assert.equal(group.players.length, 1)
    assert.equal(group.players[0].id, user.id)
  })

  test('it should return 404 when providing an unexisting group', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id + 12}/requests/${body.groupRequest.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)

    assert.equal(response.body.code, 'BAD_REQUEST')
    assert.equal(response.body.status, 404)
  })

  test('it should return 404 when providing an unexisting group request', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests/${body.groupRequest.id + 123}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)

    assert.equal(response.body.code, 'BAD_REQUEST')
    assert.equal(response.body.status, 404)
  })

  test('it should reject a group request', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    await supertest(BASE_URL)
      .delete(`/groups/${group.id}/requests/${body.groupRequest.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const groupRequest = await GroupRequest.find(body.groupRequest.id)

    assert.isNull(groupRequest)
  })

  test('it should return 404 when providing an unexisting group for rejection', async () => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    await supertest(BASE_URL)
      .delete(`/groups/${group.id + 121}/requests/${body.groupRequest.id + 123}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  test('it should return 404 when providing an unexisting group request for rejection', async () => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${token}`)

    await supertest(BASE_URL)
      .delete(`/groups/${group.id}/requests/${body.groupRequest.id + 123}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  test('it should update a group', async (assert) => {
    const group = await GroupFactory.merge({ master: user.id }).create()
    const payload = {
      name: 'test',
      description: 'test',
      schedule: 'test',
      location: 'test',
      chronic: 'test',
    }

    const { body } = await supertest(BASE_URL)
      .patch(`/groups/${group.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(200)

    assert.exists(body.group, 'Group undefined')
    assert.equal(body.group.name, payload.name)
    assert.equal(body.group.description, payload.description)
    assert.equal(body.group.schedule, payload.schedule)
    assert.equal(body.group.location, payload.location)
    assert.equal(body.group.chronic, payload.chronic)
  })

  test('it should return 404 when providing an unexisting group for update', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .patch('/groups/1')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  group.before(async () => {
    const plainPassword = '12345678'
    const res = await UserFactory.merge({ password: plainPassword }).create()
    const { body } = await supertest(BASE_URL)
      .post('/sessions')
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
