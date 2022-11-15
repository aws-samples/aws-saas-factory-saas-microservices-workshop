def pre_request(worker, req):
    if req.path == '/fulfillments/health':
        return
    worker.log.debug("%s %s" % (req.method, req.path))
