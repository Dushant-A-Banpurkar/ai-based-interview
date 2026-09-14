import {Router} from 'express';
import { createInterviewSession, endInterviewSession, getInterviewReport, getInterviewStatus } from '../controller/interview.controller';

const router=Router();

router.post('/createinterviewsession',createInterviewSession);

router.post('/:interviewId/end',endInterviewSession);

router.get('/:interview/status',getInterviewStatus);

router.get('/:interviewId/report',getInterviewReport);

export default router;