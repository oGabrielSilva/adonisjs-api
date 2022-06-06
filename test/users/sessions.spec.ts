import Database from '@ioc:Adonis/Lucid/Database'
import { UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import { BASE_URL } from './users.spec'

test.group('Session', (group) => {
  test('it should authenticate an user', async (assert) => {
    const plainPassword = '12345678'
    const { email, id } = await UserFactory.merge({ password: plainPassword }).create()
    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .send({ email, password: plainPassword })
      .expect(201)
    assert.isDefined(body.user, 'User undefined')
    assert.equal(id, body.user.id)
  })

  test('it should return an api token when session is created', async (assert) => {
    const plainPassword = '12345678'
    const { email, id } = await UserFactory.merge({ password: plainPassword }).create()
    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .send({ email, password: plainPassword })
      .expect(201)

    assert.isDefined(body.token, 'Token undefined')
    assert.equal(id, body.user.id)
  })

  test('it should return 400 when credentials are not provided', async (assert) => {
    const { body } = await supertest(BASE_URL).post('/sessions').send({}).expect(400)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 400)
  })

  test('it should return 400 when credentials are invalid', async (assert) => {
    const { email } = await UserFactory.create()
    const password = '12345678'

    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .send({ email, password })
      .expect(400)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 400)
    assert.equal(body.message, 'invalid credentials')
  })

  test('it should return 200 when user signs out', async () => {
    const plainPassword = '12345678'
    const { email } = await UserFactory.merge({ password: plainPassword }).create()
    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .send({ email, password: plainPassword })
      .expect(201)

    const { token } = body.token

    await supertest(BASE_URL)
      .delete('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  })

  test('it should revoke token when user signs out', async (assert) => {
    const plainPassword = '12345678'
    const { email } = await UserFactory.merge({ password: plainPassword }).create()
    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .send({ email, password: plainPassword })
      .expect(201)

    const { token } = body.token

    await supertest(BASE_URL)
      .delete('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    const res = await Database.query().select('*').from('api_tokens')

    assert.isEmpty(res)
  })

  group.beforeEach(async () => {
    await Database.beginGlobalTransaction()
  })

  group.afterEach(async () => {
    await Database.rollbackGlobalTransaction()
  })
})
