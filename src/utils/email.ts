import sgMail, { MailDataRequired } from '@sendgrid/mail';
import { SMTP } from '../config/globals'
import Logger from '../core/Logger'

sgMail.setApiKey(SMTP.SENDGRID_API_KEY);

export const sendMail = async (msg: MailDataRequired) => {
  try {
    const ppp = await sgMail.send({ ...msg, from: SMTP.sender })
    Logger.info(`email send to ${msg.to}`)
    console.log('====================================');
    console.log(ppp);
    console.log('====================================');
  } catch (error) {
    console.log('====================================');
    console.log(JSON.stringify(error, null, 2));
    console.log('====================================');
    Logger.info(`email send field: ${msg.to}`)
  }
}
