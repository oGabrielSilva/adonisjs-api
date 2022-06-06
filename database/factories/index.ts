import Factory from '@ioc:Adonis/Lucid/Factory'
import Group from 'App/Models/Group'
import User from 'App/Models/User'

export const UserFactory = Factory.define(User, ({ faker }) => {
  return {
    username: faker.name.findName(),
    email: faker.internet.email(),
    avatar: faker.internet.url(),
    password: faker.internet.password(),
  }
}).build()

export const GroupFactory = Factory.define(Group, ({ faker }) => {
  return {
    name: faker.name.findName(),
    description: faker.lorem.paragraph(),
    chronic: faker.lorem.sentence(),
    schedule: faker.date.weekday(),
    location: faker.internet.url(),
  }
}).build()
