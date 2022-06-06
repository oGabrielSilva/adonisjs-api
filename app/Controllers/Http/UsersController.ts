import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import BadRequestException from 'App/Exceptions/BadRequestException'
import User from 'App/Models/User'
import CreateUserValidator from 'App/Validators/CreateUserValidator'
import UpdateUserValidator from 'App/Validators/UpdateUserValidator'

export default class UsersController {
  public async store({ request: req, response: res }: HttpContextContract) {
    const userPayload = await req.validate(CreateUserValidator)

    const userByEmail = await User.findBy('email', userPayload.email)
    const userByUsername = await User.findBy('username', userPayload.username)
    if (userByEmail) throw new BadRequestException('email already in use', 409)
    if (userByUsername) throw new BadRequestException('username already in use', 409)

    const user = await User.create(userPayload)
    return res.status(201).json({ user })
  }

  public async update({ request: req, response: res, bouncer }: HttpContextContract) {
    const { email, password, avatar } = await req.validate(UpdateUserValidator)
    const id = req.param('id')
    const user = await User.findOrFail(id)

    await bouncer.authorize('updateUser', user)

    user.email = email
    user.password = password
    if (avatar) user.avatar = avatar
    await user.save()

    return res.ok({ user })
  }
}
