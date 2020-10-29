const U = require('../Shared/Utils.js')
const html = require('nanohtml')
const sgMail = require('@sendgrid/mail')
const util = require('util')

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const msg = (email, emailText) => { return {
  to: email,
  from: 'randommaster@em7473.lucabol.com', // Use the email address or domain you verified above
  subject: emailText,
  text: 'Remember, you promised to do this!!',
  html: '<h2>Remember, you promised to do this!!</h2>'
}}

const sendEmail = async (email, emailText) => await sgMail.send(msg(email, emailText))

const randomSelect= (cadence, tasks) => {
  const cadenceMap = {
    'often': 7,
    'seldom': 30,
    'rarely': 365
  }
  const cad = cadenceMap[cadence]
  const len = tasks.length

  // Probability of picking one task. Bizarrely, it can be more than zero,
  // in which case a task is certainly chosen. After intense deliberation with myself,
  // I think that is what I want. If you set more tasks than days in cadence, then
  // you get a random task every day.
  const prob = len / cad
  const coin = Math.random()
  if(coin > prob)
    return null
  else
    return tasks[Math.floor(Math.random() * len)]
}
const pickTaskForGroup = (user, name, group) => {
  // reverse to start choosing from rarer tasks
  const groupTasks = Object.keys(group).reverse().map(cadence => {
    const tasks = group[cadence]
    for(var i = 0; i < tasks.length; i++) {
      const task = randomSelect(cadence, tasks)
      if(task) {
        return `${name}: ${task.text}`
      }
    }
    return null
  })
  const groupTask = groupTasks.find(t => t) 
  return groupTask
} 

const pickTasks = user => {
  const groups = user.groups
  const tasks = Object.keys(groups).map(name => pickTaskForGroup(user, name, groups[name]))
  return tasks
}

module.exports = async function (context, myTimer) {
  try {
    const users = await U.loadAllUsers()

    const emails = users.map(user => {
      if(user) {
        const tasks = pickTasks(user).filter(t => t)
        if(tasks) {
          return tasks.map(t => { return {to: user.email, subject: t}})
        }
      } else {
        return undefined
      }
    })
    const a = await emails.toArray()
    // Flatten the array
    const b = [].concat.apply([], a)
    const promises = b.map(async t => sendEmail("lucabol@microsoft.com", t.subject))
    //const promises = b.map(async t => sendEmail(t.to, t.subject))
    const results = await Promise.allSettled(promises)
    return U.hr(html`<pre>${JSON.stringify(results, null, 2)} ${JSON.stringify(b, null, 2)}</pre>`)
  } catch(err) {
    context.log.error(err)
  }
}
