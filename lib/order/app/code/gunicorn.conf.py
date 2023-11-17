# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
def pre_request(worker, req):
    if req.path == '/orders/health' and req.method == 'GET':
        # skip logging health checks
        return
    worker.log.debug("%s %s" % (req.method, req.path))
