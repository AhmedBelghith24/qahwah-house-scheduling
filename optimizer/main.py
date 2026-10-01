from fastapi import FastAPI, HTTPException

from optimizer import optimize

app = FastAPI()


@app.get("/")
def health_check():
    return {
        "success": True,
        "message": "Qahwah House optimizer is running",
    }


@app.post("/optimize")
def run_optimizer(data: dict):
    try:
        result = optimize(data)

        if not result.get("success"):
            raise HTTPException(
                status_code=422,
                detail=result.get(
                    "message",
                    "Unable to generate schedule.",
                ),
            )

        return result

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )