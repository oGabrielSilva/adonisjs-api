import Database from '@ioc:Adonis/Lucid/Database'
import { UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'
import { BASE_URL } from './users.spec'
import Mail from '@ioc:Adonis/Addons/Mail'
import Hash from '@ioc:Adonis/Core/Hash'
import { DateTime, Duration } from 'luxon'

test.group('Password', (group) => {
  test('it should send and email with forgot password instructions', async (assert) => {
    const { email, username } = await UserFactory.create()

    const mailer = Mail.fake()

    await supertest(BASE_URL)
      .post('/forgot-password')
      .send({
        email,
        resetPasswordURL: 'https://supertest.com/' + email,
      })
      .expect(204)

    assert.isTrue(
      mailer.exists((mail) => {
        return mail.subject === 'Roleplay: Recupere sua senha'
      })
    )

    assert.isTrue(
      mailer.exists((mail) => {
        if (mail.to) {
          return mail.to[0].address === email
        }
        return false
      })
    )

    assert.isTrue(
      mailer.exists((mail) => {
        if (mail.from) {
          return mail.from.address === 'no-reply@roleplay.com'
        }
        return false
      })
    )

    mailer.exists((mail) => {
      assert.exists(mail.html, username)
      return true
    })
    Mail.restore()
  })

  test('it should create a reset password token', async (assert) => {
    const user = await UserFactory.create()

    await supertest(BASE_URL)
      .post('/forgot-password')
      .send({ email: user.email, resetPasswordURL: 'url' })
      .expect(204)

    const tokens = await user.related('tokens').query()
    assert.isNotEmpty(tokens)
  }).timeout(15000)

  test('it should return 422 when required data is not provided or data is invalid', async (assert) => {
    const { body } = await supertest(BASE_URL).post('/forgot-password').send({}).expect(422)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should be able to reset password', async (assert) => {
    const user = await UserFactory.create()
    const { token } = await user.related('tokens').create({ token: 'tokentokentokentokentoke' })
    const password = '12345678'

    await supertest(BASE_URL).post('/reset-password').send({ token, password }).expect(204)

    await user.refresh()
    const checkPassword = await Hash.verify(user.password, password)

    assert.isTrue(checkPassword)
  })

  test('it should return 422 when required data is not provided or data is invalid', async (assert) => {
    const { body } = await supertest(BASE_URL).post('/reset-password').send({}).expect(422)
    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should return 404 when using the same token twice', async (assert) => {
    const user = await UserFactory.create()
    const { token } = await user.related('tokens').create({ token: 'tokentokentokentokentoke' })
    const password = '12345678'

    await supertest(BASE_URL).post('/reset-password').send({ token, password }).expect(204)
    const { body } = await supertest(BASE_URL)
      .post('/reset-password')
      .send({ token, password })
      .expect(404)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 404)
  })

  test('it cannot reset password when token is expired after 2 hours', async (assert) => {
    const user = await UserFactory.create()
    const password = '12345678'
    const createdAt = DateTime.now().minus(Duration.fromISOTime('02:01'))
    const { token } = await user
      .related('tokens')
      .create({ token: 'tokentokentokentokentoke', createdAt })

    const { body } = await supertest(BASE_URL)
      .post('/reset-password')
      .send({ token, password })
      .expect(410)

    assert.equal(body.code, 'TOKEN_EXPIRED')
    assert.equal(body.status, 410)
    assert.equal(body.message, 'token has expired')
  })

  group.beforeEach(async () => {
    await Database.beginGlobalTransaction()
  })

  group.afterEach(async () => {
    await Database.rollbackGlobalTransaction()
  })
})
