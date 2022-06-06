import Mail from '@ioc:Adonis/Addons/Mail'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import TokenExpiredException from 'App/Exceptions/TokenExpiredException'
import User from 'App/Models/User'
import ForgotPasswordValidator from 'App/Validators/ForgotPasswordValidator'
import ResetPasswordValidator from 'App/Validators/ResetPasswordValidator'
import { randomBytes } from 'crypto'
import { promisify } from 'util'

export default class PasswordsController {
  public async forgotPassword({ request, response }: HttpContextContract) {
    const { email, resetPasswordURL } = await request.validate(ForgotPasswordValidator) //request.only(['email', 'resetPasswordURL'])
    const user = await User.findByOrFail('email', email)

    const random = await promisify(randomBytes)(24)
    const token = random.toString('hex')

    await user.related('tokens').updateOrCreate({ userId: user.id }, { token })

    const resetPasswordURLWithToken = `${resetPasswordURL}?token=${token}`
    await await Mail.send((message) => {
      message
        .from('no-reply@roleplay.com')
        .to(email)
        .subject('Roleplay: Recupere sua senha')
        .htmlView('email/forgotpassword', {
          productName: 'Roleplay',
          name: user.username,
          resetPasswordURL: resetPasswordURLWithToken,
        })
    })
    return response.noContent()
  }

  public async resetPassword({ request, response }: HttpContextContract) {
    const { token, password } = await request.validate(ResetPasswordValidator)

    const userByToken = await User.query()
      .whereHas('tokens', (query) => query.where('token', token))
      .preload('tokens')
      .firstOrFail()
    userByToken.password = password

    const tokenAge = userByToken.tokens[0].createdAt.diffNow('hours').hours
    if (Math.abs(tokenAge) > 2) throw new TokenExpiredException()

    await userByToken.save()
    await userByToken.tokens[0].delete()

    return response.noContent()
  }
}
