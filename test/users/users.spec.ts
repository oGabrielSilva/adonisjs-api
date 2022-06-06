import Database from '@ioc:Adonis/Lucid/Database'
import { UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import Hash from '@ioc:Adonis/Core/Hash'
import User from 'App/Models/User'

export const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`

let token = ''
let user = {} as User

const email = 'charlotte@perfeito.com'
const username = 'cadeCharlotte'
const password = 'admin123admin'
const avatar =
  'https://kanto.legiaodosherois.com.br/w760-h398-gnw-cfill-q95/wp-content/uploads/2020/08/legiao_mSNt5HbGDRO6.jpg.jpeg'

test.group('User', (group) => {
  test('it should create an user', async (assert) => {
    const userPayload = {
      email,
      username,
      password,
      avatar,
    }

    const { body } = await supertest(BASE_URL).post('/users').send(userPayload).expect(201)
    assert.exists(body.user, 'User undefined')
    assert.exists(body.user.id, 'ID undefined')
    assert.equal(body.user.email, userPayload.email)
    assert.equal(body.user.username, userPayload.username)
    assert.notExists(body.user.password, 'Password defined')
  })

  test('it should return 409 when email already in use', async (assert) => {
    const { email } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({
        email,
        username,
        password,
      })
      .expect(409)

    assert.exists(body.message)
    assert.exists(body.code)
    assert.exists(body.status)
    assert.include(body.message, 'email')
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 409)
  })

  test('it should return 409 when username already in use', async (assert) => {
    const { username } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({
        email,
        username,
        password,
      })
      .expect(409)

    assert.exists(body.message)
    assert.exists(body.code)
    assert.exists(body.status)
    assert.include(body.message, 'username')
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 409)
  })

  test('it should return 422 when required data is not provided', async (assert) => {
    const { body } = await supertest(BASE_URL).post('/users').send({}).expect(422)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should return 422 when email is not provided', async (assert) => {
    const email = 'abc@acc'
    const { username, password } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({ username, password, email })
      .expect(422)

    assert.exists(body.message)
    assert.exists(body.code)
    assert.exists(body.status)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should return 422 when password is not provided', async (assert) => {
    const password = '1234567'
    const { username, email } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .post('/users')
      .send({ username, email, password })
      .expect(422)

    assert.exists(body.message)
    assert.exists(body.code)
    assert.exists(body.status)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should update an user', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: user.password, avatar, email: user.email })
      .expect(200)

    assert.exists(body.user, 'User undefined')
    assert.equal(body.user.email, user.email)
    assert.equal(body.user.avatar, avatar)
    assert.equal(body.user.id, user.id)
  })

  test('it should update the password of the user', async (assert) => {
    const { body } = await supertest(BASE_URL)
      .put(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password, avatar: user.avatar, email: user.email })
      .expect(200)

    assert.exists(body.user, 'User undefined')
    assert.equal(body.user.id, user.id)

    await user.refresh()
    assert.isTrue(await Hash.verify(user.password, password))
  })

  test('it should return 422 when required data is not provided', async (assert) => {
    const { id } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .put(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it shoul return 422 when providing an invalid email', async (assert) => {
    const { id } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .put(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'tt@tt', password })
      .expect(422)

    assert.notExists(body.user, 'User undefined')

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })
  test('it shoul return 422 when providing an invalid avatar', async (assert) => {
    const avatar = 'kanto.legiaodosherois.sao_mSNt5HbGDRO6.'
    const { id, email } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .put(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, password, avatar })
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.notExists(body.user, 'User undefined')

    assert.equal(body.status, 422)
  })
  test('it shoul return 422 when providing an invalid password', async (assert) => {
    const password = '123'
    const { id, email } = await UserFactory.create()
    const { body } = await supertest(BASE_URL)
      .put(`/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, password })
      .expect(422)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.notExists(body.user, 'User undefined')

    assert.equal(body.status, 422)
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
